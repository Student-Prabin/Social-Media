import { Route, Routes, useLocation } from "react-router-dom"
import Login from "./pages/Login.jsx"
import Feed from "./pages/Feed.jsx"
import Messages from "./pages/Messages.jsx"
import ChatBox from "./pages/ChatBox.jsx"
import Connections from "./pages/Connections.jsx"
import Discover from "./pages/Discover.jsx"
import Profile from "./pages/Profile.jsx"
import CreatePost from "./pages/CreatePost.jsx"
import { useUser, useAuth } from '@clerk/clerk-react'
import Layout from "./pages/Layout.jsx"
import toast, { Toaster } from "react-hot-toast"
import { useEffect, useRef } from "react"
import { useDispatch } from 'react-redux'
import { fetchUser } from "./features/user/userSlice.js"
import { fetchConnections } from "./features/connections/connectionsSlice.js"
import { addMessages } from "./features/messages/messagesSlice.js"
import Notifications from "./components/Notifications.jsx"


const App = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);


  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        const token = await getToken()
        dispatch(fetchUser(token))
        dispatch(fetchConnections(token))
      }
    }
    fetchData()
  }, [user, getToken, dispatch]);

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])
  useEffect(() => {
    if (user) {
      const eventSource = new EventSource(import.meta.env.VITE_BASEURL + '/api/message/' + user.id)
      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (pathnameRef.current === (`/messages/` + message.from_user_id._id)) {
          dispatch(addMessages(message))
        } else {
          toast.custom((t) => (
            <Notifications t={t} message={message} />
          ), { position: 'bottom-right' })
        }
      }
      return () => {
        eventSource.close();
      }
    }
  }, [user, dispatch])
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={!user ? <Login /> : <Layout />}>
          <Route index element={<Feed />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:userId" element={<ChatBox />} />
          <Route path="connections" element={<Connections />} />
          <Route path="discover" element={<Discover />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:profileId" element={<Profile />} />
          <Route path="create-post" element={<CreatePost />} />

        </Route>
      </Routes>
    </>
  )
}
export default App