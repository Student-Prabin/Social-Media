
import fs from 'fs'
import imageKit from "../configs/imageKit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

export const addPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, post_type } = req.body;
    const images = req.files


    let image_urls = []

    if (images.length) {
      image_urls = await Promise.all(
        images.map(async (image) => {
          const fileBuffer = fs.readFileSync(image.path);

          const response = await imageKit.upload({
            file: fileBuffer,
            fileName: image.originalname,
            folder: "posts",
          });

          const url = imageKit.url({
            path: response.filePath,
            transformation: [
              { quality: "auto" },
              { format: "webp" },
              { width: "1280" },
            ],
          });

          return url;
        })
      );
    }

    await Post.create({
      user: userId,
      content,
      image_urls,
      post_type
    })
    res.json({ success: true, message: "Post created successfully" })
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
}

export const getFeedPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const user = await User.findById(userId);

    const userIds = [userId, ...user.connections, ...user.following];
    const posts = await Post.find({ user: { $in: userIds } }).populate('user').sort({ createdAt: -1 });

    res.json({ success: true, posts });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }

}

export const likePost = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { postId } = req.body;

    const post = await Post.findById(postId);

    if (post.likes_count.includes(userId)) {
      post.likes_count = post.likes_count.filter(user => user !== userId)
      await post.save()
      res.json({ success: true, message: 'Post unliked' });
    } else {
      post.likes_count.push(userId);
      await post.save();
      res.json({ success: true, message: 'Post liked' });
    }

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }

}

// Add comment to a post
export const addComment = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId, text } = req.body;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const comment = { user: userId, text };
    post.comments.push(comment);
    await post.save();

    // Populate user data for response
    const populatedPost = await Post.findById(postId).populate('comments.user', 'full_name profile_picture');

    res.json({ success: true, post: populatedPost });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get comments for a post
export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId).populate('comments.user', 'full_name profile_picture');
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    res.json({ success: true, comments: post.comments });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
}