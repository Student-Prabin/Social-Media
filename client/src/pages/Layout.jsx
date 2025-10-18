import { Outlet } from "react-router-dom"
import Sidebar from "../components/Sidebar.jsx"
import { useState } from "react"
import { Menu, X } from "lucide-react";
import Loading from "../components/Loading.jsx";
import { useSelector } from "react-redux";
import { dummyUserData } from "../assets/assets.js";

const Layout = () => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useSelector((state) => state.user.value);

  return user ? (
    <div className="w-full  flex h-screen">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 bg-slate-50">
        <Outlet />
      </div>
      {
        sidebarOpen ? <X className="absolute top-3 right-3 p-2 z-100 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden" onClick={() => { setSidebarOpen(false) }} />
          :
          <Menu className="absolute top-3 right-3 p-2 z-100 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden" onClick={() => { setSidebarOpen(true) }} />
      }
    </div>
  ) : (
    <Loading />
  )
}
export default Layout