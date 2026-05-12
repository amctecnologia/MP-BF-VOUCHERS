import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import routes from './routes';

const app = express();

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);

export default app;
