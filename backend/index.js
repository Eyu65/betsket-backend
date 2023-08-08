const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const User = require('./models/User');
const Post = require('./models/Post');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const filesMiddleware = multer({ dest: 'files/'});
const fs = require('fs');

const app = express();

const salt = bcrypt.genSaltSync(10);
const secret = process.env.SECRET_KEY;


const port = 4000;

app.use(cors({credentials: true, origin: 'http://localhost:3000', "https://betsket.com"}));
app.use(express.json());
app.use(cookieParser());
app.use('/files', express.static(__dirname + '/files'));

 mongoose.connect(process.env.MONGO_URI);


app.post('/register', async (req, res) => {
    const {username, password} = req.body;
    try{
        const userDoc = await User.create({
          username,
          password: bcrypt.hashSync(password,salt)
        });
        res.json(userDoc);
      } catch(e) {
        res.status(400).json(e);
      }
});

app.post('/login', async (req, res) => {

  const {username, password} = req.body;
  const userDoc = await User.findOne({username});
  const passwordMatched = bcrypt.compareSync(password, userDoc.password);
  
  if(passwordMatched) {
    jwt.sign({ username, id: userDoc._id}, secret, {}, (err, token) => {

      if (err) throw err;
      res.cookie('token', token).json({
        id: userDoc._id,
        username,
        });
      });
    } else {
      res.status(400).json('wrong credentials');
    }
});

app.get('/profile', (req, res) => {
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

app.post('/post', filesMiddleware.single('file'), async(req, res) => {
  const {originalname, path} = req.file;
  const parts = originalname.split('.');
  const extension = parts[parts.length - 1];
  const newPath = path+'.'+extension;
  fs.renameSync(path, newPath);
  
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author:info.id, 
    });
    res.json(postDoc);
  });

});

app.put('/post',filesMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path+'.'+ext;
    fs.renameSync(path, newPath);
  }

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id, title, summary, content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    await postDoc.updateOne ({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });

});

app.get('/post', async (req,res) => {
  res.json(
    await Post.find()
      .populate('author', ['username'])
      .sort({createdAt: -1})
      .limit(20)
  );
});

app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
});


app.listen(port, () => console.log(`App listening on port ${port}!`));
