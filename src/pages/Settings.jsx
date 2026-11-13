
import { useState } from 'react';
import { Settings as SettingsIcon, User, Shield, Bell, Lock, Save } from 'lucide-react';

export default function Settings() {
  const [profile, setProfile] = useState({
    name: 'Administrator',
    email: '',
    notifications: true,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-blue-600" size={28}/>
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <p className="text-slate-500 mt-2">
            Manage your administrator preferences.
          </p>
        </div>

        <div className="bg-white border rounded-2xl p-7 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-blue-600"/>
            <h2 className="font-bold text-lg">Administrator Profile</h2>
          </div>

          <label className="block text-sm font-medium mb-2">Full Name</label>
          <input
            value={profile.name}
            onChange={e => setProfile({...profile, name:e.target.value})}
            className="w-full border rounded-xl p-3 mb-5"
          />

          <label className="block text-sm font-medium mb-2">Email Address</label>
          <input
            type="email"
            value={profile.email}
            onChange={e => setProfile({...profile, email:e.target.value})}
            placeholder="Enter admin email"
            className="w-full border rounded-xl p-3"
          />
        </div>

        <div className="bg-white border rounded-2xl p-7 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <Bell className="text-blue-600"/>
            <h2 className="font-bold text-lg">Notifications</h2>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-700">
              Enable signing notifications
            </span>
            <input
              type="checkbox"
              checked={profile.notifications}
              onChange={e => setProfile({...profile, notifications:e.target.checked})}
              className="w-5 h-5 accent-blue-600"
            />
          </label>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 text-blue-800">
            <Shield size={21}/>
            <span className="font-semibold">Security information</span>
          </div>
          <p className="text-sm text-blue-700 mt-2">
            Administrator authentication and password management
            will be handled through the backend.
          </p>
          <div className="flex items-center gap-2 mt-3 text-sm text-blue-700">
            <Lock size={16}/> Protected administrator access
          </div>
        </div>

        <button
          onClick={() => alert('Preferences are currently stored only in this page. Backend persistence will be added later.')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-xl flex items-center gap-2 font-semibold"
        >
          <Save size={18}/> Save Preferences
        </button>
      </div>
    </div>
  );
}
