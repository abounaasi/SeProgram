import dotenv from "dotenv"
import path from "path"
import { env } from "process"
dotenv.config({path:path.join(__dirname, '../.env')})
export default{
    secret: process.env.secret|| 'default secret',
    NODE_ENV: process.env.NODE_ENV || 'development',
    logDir: path.join(__dirname, '../logs')  
}