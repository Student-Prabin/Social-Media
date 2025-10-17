import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import { inngest, functions } from './inngest/index.js'
const app = express();
import { serve } from 'inngest/express';
await connectDB();

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => res.send('Server Running'));
app.use('/api/inngest', serve({ client: inngest, functions }));


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log('server is runnung on port ' + PORT),);
