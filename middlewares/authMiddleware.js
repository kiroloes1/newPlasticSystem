const jwt=require('jsonwebtoken');
const User=require(`${__dirname}/../models/users`);
exports.protected=async(req,res,next)=>{
    const authHeader=req.headers.authorization;;
    if(!authHeader || !authHeader.startsWith('Bearer')){
        return res.status(401).json({message:"No token provided , you must be logged in"});
    }
    const token=authHeader.split(" ")[1];
    if(!token){
        return res.status(401).json({message:"No token provided , you must be logged in"});
    }
    try{
     const decoded=jwt.verify(token,process.env.ACCESS_JWT_SECRET);
     if(!decoded){
        return res.status(401).json({message:"Invalid token"});
     }
     const user=await User.findById(decoded.userId).select('-password');
     if(!user){
        return res.status(401).json({message:"The user belonging to this token no longer exists"});
     }
     req.user=decoded;
     next();

    }catch(error){
        res.status(401).json({message:"Invalid token",error:error.message});
    }
}