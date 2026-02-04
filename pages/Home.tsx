import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Smartphone, MapPin, Clock, TrendingUp, Activity } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Smartphone className="text-primary-600" size={32} />,
      title: 'Device Management',
      description: 'Connect and monitor all your children\'s devices in one place',
      action: () => navigate('/devices')
    },
    {
      icon: <MapPin className="text-green-600" size={32} />,
      title: 'Location Tracking',
      description: 'Keep track of your child\'s location in real-time with GPS',
      action: () => navigate('/devices')
    },
    {
      icon: <Clock className="text-orange-600" size={32} />,
      title: 'App Time Limits',
      description: 'Set daily limits and schedules for app usage',
      action: () => navigate('/devices')
    },
    {
      icon: <Shield className="text-red-600" size={32} />,
      title: 'Web Filtering',
      description: 'Block harmful websites and monitor browsing history',
      action: () => navigate('/devices')
    }
  ];

  const stats = [
    { label: 'Protected Devices', value: '0', icon: <Smartphone size={20} />, color: 'bg-blue-500' },
    { label: 'Apps Monitored', value: '0', icon: <Activity size={20} />, color: 'bg-green-500' },
    { label: 'Hours Saved', value: '0', icon: <TrendingUp size={20} />, color: 'bg-purple-500' }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-4">Welcome to ParentGuard</h1>
          <p className="text-lg text-primary-100 mb-6">
            Keep your children safe online with comprehensive monitoring and controls
          </p>
          <button
            onClick={() => navigate('/devices')}
            className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors shadow-lg"
          >
            Get Started - Add Your First Device
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Features Grid */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              onClick={feature.action}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-primary-50 transition-colors">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-sm">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Start Guide</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
            <p className="text-slate-700">Download and install the ParentGuard child app on your child's device</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <p className="text-slate-700">Go to Devices page and click "Pair New Device"</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">3</div>
            <p className="text-slate-700">Enter the 6-digit pairing code on the child's device</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">4</div>
            <p className="text-slate-700">Start monitoring and protecting your child online!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
