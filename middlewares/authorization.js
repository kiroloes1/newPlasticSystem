exports.role=(...role)=>{
    return (req,res,next)=>{

         if (!req.user || !req.user.role) {
        return res.status(401).json({ message: "Unauthenticated" });
        }

        if(!role.includes(req.user.role)){
            return res.status(403).json({message:"You are not authorized to access this route"});
        }
        next();
    }
}