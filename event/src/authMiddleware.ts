import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';


export const verifyToken = (token)  => {
    try {
        //console.log("tokenData", token);
        const string_token = process.env.INTERNAL_TOKEN_KEY as string;
        //console.log("token_key, ", string_token)
        const tokenData = jwt.verify(token, string_token);
        return tokenData ;
    } catch (error) {
        throw new Error('wrong token' + error);
    }
  };

  export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    //console.log("authMiddleware")
    const auth = req.headers.authorization;
    if (auth ) {
        const tokenData = verifyToken(auth);
        //console.log("tokenData", tokenData)
        if(tokenData != process.env.INTERNAL_TOKEN_CODE){
            throw new Error('problem in authorization process');
        }
        next();
    } else {
        throw new Error('No token');
    }
  };
