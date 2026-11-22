# Deploying AgriHire (Vercel + MongoDB Atlas)

Online layout: Vercel serves the pages (public/) and runs the Node.js backend as one serverless function (api/index.js -> backend/app.js).
The database is MongoDB Atlas. Your computer's Node / MongoDB versions do not matter: everything is built in the cloud.

Environment variables to set in Vercel (Project -> Settings -> Environment Variables):
    JWT_SECRET    long random text
    MONGO_URI     mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/agrihire?retryWrites=true&w=majority
    SMS_PROVIDER  console (code appears in Vercel logs)  or  fast2sms
    FAST2SMS_KEY  only when SMS_PROVIDER=fast2sms

Local run is unchanged: cd backend && npm start
