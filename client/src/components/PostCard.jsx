import { BadgeCheck, Heart, MessageCircle, Share2 } from "lucide-react"
import moment from "moment"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import api from "../api/axios.js"
import { useAuth } from "@clerk/clerk-react"
import toast from "react-hot-toast"

const PostCard = ({ post }) => {
  const nav = useNavigate()
  const postWithHashtags = post.content.replace(/(#\w+)/g, '<span class="text-indigo-600">$1</span>')

  const [likes, setLikes] = useState(post.likes_count)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState("")
  const [showComments, setShowComments] = useState(false) // toggle comment section
  const currentUser = useSelector((state) => state.user.value)
  const { getToken } = useAuth()

  // Fetch comments on mount for accurate count
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const { data } = await api.get(`/api/post/comment/${post._id}`, {
          headers: { Authorization: `Bearer ${await getToken()}` }
        })
        if (data.success) setComments(data.comments)
      } catch (error) {
        toast.error(error.message)
      }
    }
    fetchComments()
  }, [post._id, getToken])

  const handleLike = async () => {
    try {
      const { data } = await api.post('/api/post/like', { postId: post._id }, { headers: { Authorization: `Bearer ${await getToken()}` } })
      if (data.success) {
        toast.success(data.message)
        setLikes(prev => prev.includes(currentUser._id) ? prev.filter(id => id !== currentUser._id) : [...prev, currentUser._id])
      } else {
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return
    try {
      const { data } = await api.post('/api/post/comment',
        { postId: post._id, text: commentText },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )
      if (data.success) {
        setComments(data.post.comments)
        setCommentText("")
        toast.success("Comment added")
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleToggleComments = () => {
    setShowComments(prev => !prev)
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-4 w-full max-w-2xl">
      {/* user info */}
      <div onClick={() => nav('/profile/' + post.user._id)} className="inline-flex items-center gap-3 cursor-pointer">
        <img src={post.user.profile_picture} alt="" className="w-10 h-10 rounded-full shadow" />
        <div>
          <div className="flex items-center space-x-1">
            <span>{post.user.full_name}</span>
            <BadgeCheck className=" w-4 h-4 text-blue-500" />
          </div>
          <div className="text-gray-500 text-sm">@{post.user.username} .{moment(post.createdAt).fromNow()}</div>
        </div>
      </div>

      {/* content */}
      {post.content && <div className="text-gray-800 text-sm whitespace-pre-line" dangerouslySetInnerHTML={{ __html: postWithHashtags }} />}

      {/* images */}
      <div className="grid grid-cols-2 gap-2">
        {post.image_urls.map((img, index) => (
          <img src={img} key={index} alt="" className={`w-full h48 object-cover rounded-lg ${post.image_urls.length === 1 && 'col-span-2 h-auto'}`} />
        ))}
      </div>

      {/* like, comment, share */}
      <div className="flex items-center gap-4 text-gray-600 text-sm pt-2 border-t border-gray-300">
        <div className="flex items-center gap-1">
          <Heart className={`w-4 h-4 cursor-pointer ${likes.includes(currentUser._id) && 'text-red-500 fill-red-500'}`} onClick={handleLike} />
          <span>{likes.length}</span>
        </div>

        <div className="flex items-center gap-1 cursor-pointer" onClick={handleToggleComments}>
          <MessageCircle className='w-4 h-4 ' />
          <span>{comments.length}</span>
        </div>

      </div>

      {/* comment section */}
      {showComments && (
        <div className="mt-2 border-t border-gray-300 pt-2">
          {comments.map((c, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <img src={c.user.profile_picture} alt="" className="w-6 h-6 rounded-full" />
              <div className="bg-gray-100 rounded-xl px-3 py-1 text-sm">
                <span className="font-medium">{c.user.full_name}:</span> {c.text}
              </div>
            </div>
          ))}

          {/* add comment */}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-1 rounded-full border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleCommentSubmit}
              className="px-3 py-1 bg-indigo-500 text-white rounded-full hover:bg-indigo-600"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PostCard
