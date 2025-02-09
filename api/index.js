const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const User =require('./models/User');
const Post  =require('./models/post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser =require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({dest:'uploads/'});
const fs =require('fs');
require('dotenv').config();  // Load environment variables
const path =require("path")
const salt=bcrypt.genSaltSync(10);
const secret =process.env.JWT_SECRET;
app.use(cors({
  origin: ['http://localhost:3000', 'http://13.48.42.96:3000'], // Add your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
//app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB Connected",))
.catch(err => console.error("MongoDB connection error:", err));
const buildpath =path.join(__dirname,"../client/build")  //buil path codes fro aws
app.use(express.static(buildpath))//to run the build file
app.use(cors({
  origin: '*', // Allow all origins (for testing, change it to specific domain in production)
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
// app.use(cors({
//   "origin":"*"
// }))
app.use(cookieParser());
app.use('/uploads',express.static(__dirname + '/uploads'))

app.post('/register', async (req, res) => {
    const {username,password}=req.body;
    try{
    const userDoc= await User.create({username,
        password:bcrypt.hashSync(password,salt),
    });
    res.json(userDoc);
    }catch(e){
        res.status(400).json(e);
        // console.log(e)

    }
});

app.post('/login' ,async (req,res)=>{
    const {username,password} =req.body;
    const userDoc = await User.findOne({username});
    const passOk=bcrypt.compareSync(password, userDoc.password);
   if (passOk){
    //logged in
    jwt.sign({username,id:userDoc._id},secret,{},(err,token)=>{
        if(err) throw err;
        res.cookie('token',token).json({id:userDoc._id,username});
    });
   }else{
    res.status(400).json('wrong crendentials')
   }
});

app.get('/profile',(req,res)=>{
    const {token} =req.cookies;
    jwt.verify(token,secret,{},(err,info)=>{
    if (err) throw err;
    res.json(info);
    });
});
   app.post('/logout', (req,res) =>{
    res.cookie('token','').json('ok');
   });

   app.post('/post', uploadMiddleware.single('files'), async(req,res)=>{
    const {originalname,path} =req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext;
    fs.renameSync(path,newPath);

    const {token} =req.cookies;
    jwt.verify(token,secret,{}, async(err,info)=>{
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
        title,
        summary,
        content,
        cover:newPath,
        author:info.id,

    });
    res.json({postDoc});
   
    });

   
   });
   app.put('/post', uploadMiddleware.single('files'), async(req,res)=> {
    let newPath = null;
    if (req.file) {
    const {originalname,path} =req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
     newPath = path+'.'+ext;
    fs.renameSync(path,newPath);
    }
  
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
      if (err) throw err;
      const {id,title,summary,content} = req.body;
      const postDoc =await Post.findById(id);
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json('you are not the author');
      }
      await Post.updateOne(
        { _id: id, author: info.id }, // Add any other conditions to uniquely identify the post
        {
          $set: {
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
          },
        }
      );
      
  
      res.json(postDoc);
      console.log(postDoc);
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
app.get('/post/:id',async(req,res) => {
    const {id} =req.params;
    const postDoc =await Post.findById(id).populate('author',['username']);
    res.json(postDoc);
})

app.listen(4000);
