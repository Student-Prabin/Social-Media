import fs from 'fs';
import imageKit from '../configs/imageKit.js';
import Message from '../models/Message.js';

// empty object to store  server-side event connections
const connections = {}

// controller function for the SSE <endpoing></endpoing>
export const serverSideEventController = (req, res) => {
  const { userId } = req.params;
  console.log('new client connected:', userId);

  //set sse headers
  res.setHeader('Content-Type', "text/event-stream");
  res.setHeader('Cache-Control', "no-cache");
  res.setHeader('Connection-Control', "keep-alive");
  res.setHeader('Access-Control-Allow-Origin ', "*");

  // Add client's response to the connections object
  connections[userId] = res

  // send an initial event to the client
  res.write('log:Connected to SSE stream\n\n');

  // handle client disconnect
  req.on('close', () => {
    // remove the clients res object from connection array
    delete connections[userId];
    console.log('Client disconnected');

  })

}

export const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id, text } = req.body;
    const image = req.file;

    let media_url = '';
    let message_type = image ? 'image' : 'text';

    if (message_type === 'image') {
      const fileBuffer = fs.readFileSync(image.path);
      const response = await imageKit.upload({
        file: fileBuffer,
        fileName: image.originalname,
      })
      media_url = imageKit.url({
        path: response.filePath,
        transformation: [
          { quality: 'auto' },
          { format: 'webp' },
          { width: '1280' }

        ]
      })
      const message = await Message.create({
        from_user_id: userId,
        to_user_id,
        text,
        message_type,
        media_url
      })
      res.json({ success: true, message });
      // Send message to userId using SSE
      const messageWithUserData = await Message.findById(message._id).populate('from_user_id');
      if (connections[to_user_id]) {
        connections[to_user_id].write(`data${JSON.stringify(messageWithUserData)}\n\n`)
      }
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
}

// getChatMessages
export const getChatMessages = async (req, res) => {

  try {
    const { userId } = req.auth();
    const { to_user_id } = req.body;

    const messages = await Message.find(
      {
        $or: [
          { from_user_id: userId, to_user_id },
          { from_user_id: to_user_id, userId },
        ]
      }).sort({ createdAt: -1 })

    //mark messages as seen
    await Message.updateMany({ from_user_id: to_user_id, to_user_id: userId }, { seen: true });
    res.json({ success: true, messages });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

export const getUserRecentMessages = async (req, res) => {
  try {
    const { userId } = req.auth();
    const messages = await Message.find({ to_user_id: userId }.populate('from_user_id to_user_id')).sort({ createdAt: -1 });

    res.json({ success: true, messages });

  } catch (error) {
    res.json({ success: false, message: error.message });

  }
}

