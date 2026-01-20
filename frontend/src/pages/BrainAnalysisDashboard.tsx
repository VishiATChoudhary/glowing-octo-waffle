
import React from 'react';
import { Search, User, Menu, X, Home as HomeIcon, Calendar, TrendingUp, Users, Settings, Brain, Waves, Zap, Droplet, Expand, Speaker } from 'lucide-react';
import Logo from '../components/Logo';

const BrainAnalysisDashboard = () => {
  return (
    <div className="flex-1 p-8 bg-gray-100 min-h-screen">
      {/* Top Navbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-8">
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
            <Search className="text-gray-500 mr-2" size={20} />
            <input
              type="text"
              placeholder="Search"
              className="bg-transparent outline-none text-gray-700 placeholder-gray-500 w-48"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
              <User className="text-gray-600" size={18} />
            </div>
            <span className="text-gray-700 font-medium">Tomas Brown</span>
          </div>
          <Menu className="text-gray-700" size={20} />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Central Section (takes 2/3 width on md and up) */}
        <div className="md:col-span-2 p-6 rounded-3xl shadow-sm relative bg-noise overflow-hidden">
          <div className="absolute top-4 left-4 text-gray-800 text-lg font-semibold">My Dashboard</div>
          <div className="flex items-center justify-center h-full">
            <div className="relative w-96 h-96 flex items-center justify-center"> {/* Container for AnimatedCircle and text */}
              <Logo size={300} /> {/* Animated arcs with "84" in center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8 text-center">
                <p className="text-gray-600 text-sm">New Papers</p>
                <Waves className="text-blue-500 w-12 h-12 mx-auto mt-2" /> {/* Waveform icon */}
              </div>
            </div>

              {/* 3D Brain Model (now a white squared card) */}
              <div className="absolute left-[10%] top-[75%] -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-xl shadow-md flex flex-col items-center justify-center text-sm w-32 h-20">
                <Brain className="text-blue-500" size={16} />
                <p className="text-gray-700 mt-1">3D Brain</p>
              </div>

            </div>
                      {/* Full brain MRI card */}
          <div className="absolute right-8 top-1/4 bg-white p-3 rounded-lg shadow-md flex flex-col items-center justify-center text-sm">
            <div className="flex items-center justify-between w-full">
              <Brain className="text-blue-500" size={16} />
              <Expand className="text-gray-500" size={16} /> {/* Placeholder for arrow icon */}
            </div>
            <p className="text-gray-700 mt-2">Full brain MRI</p>
            <div className="flex mt-2 space-x-1">
              <img src="https://via.placeholder.com/30/gray/white?text=MRI" alt="MRI 1" className="rounded-sm" />
              <img src="https://via.placeholder.com/30/gray/white?text=MRI" alt="MRI 2" className="rounded-sm" />
              <img src="https://via.placeholder.com/30/gray/white?text=MRI" alt="MRI 3" className="rounded-sm" />
            </div>
          </div>
          </div>


        {/* Right Section (placeholder for other cards in central section) */}
        <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-sm bg-noise">
          {/* Placeholder for other top right content */}
        </div>
      </div>

      {/* Bottom Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        {/* Dopamine Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm bg-noise">
          <div className="flex justify-between items-center mb-4">
            <Brain className="text-blue-500" size={16} />
            <Expand className="text-gray-500" size={20} />
          </div>
          <p className="text-gray-600 text-sm">Researchers Contacted</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold text-gray-800">12g</p>
            <span className="text-green-500 text-xs font-semibold">+20%</span>
          </div>
        </div>

        {/* Fluid Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm bg-noise">
          <div className="flex justify-between items-center mb-4">
            <Droplet className="text-blue-500" size={16} />
            <Expand className="text-gray-500" size={20} />
          </div>
          <p className="text-gray-600 text-sm">Answer Rate</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold text-gray-800">1.7l</p>
            <span className="text-green-500 text-xs font-semibold">+5%</span>
          </div>
        </div>

        {/* Serotonin Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm bg-noise">
          <div className="flex justify-between items-center mb-4">
            <Speaker className="text-blue-500" size={16} />
            <Expand className="text-gray-500" size={20} />
          </div>
          <p className="text-gray-600 text-sm">Institute X</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold text-gray-800">55g</p>
            <span className="text-red-500 text-xs font-semibold">-2.0%</span>
          </div>
        </div>

        {/* Large Blue Card */}
        <div className="bg-blue-500 p-6 rounded-3xl shadow-sm relative overflow-hidden">
          <Zap className="text-white absolute top-4 left-4" size={24} />
          <Expand className="text-white absolute top-4 right-4" size={20} />
        </div>
      </div>
    </div>
  );
};

export default BrainAnalysisDashboard;
