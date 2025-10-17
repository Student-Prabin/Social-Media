import express from 'express'
import { protect } from '../middlewares/auth.js';
import { addUserStory, getStories } from '../controllers/storyController.js';
import { upload } from '../configs/multer.js';

const storyRouter = express.Router();

storyRouter.post('/create', upload.single('media'), protect, addUserStory);
storyRouter.get('/get', protect, getStories);

export default storyRouter
