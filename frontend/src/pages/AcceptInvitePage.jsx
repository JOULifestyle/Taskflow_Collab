import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInvite } from '../api/invites';
import { useAuth } from '../context/AuthContext';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleInvite = async () => {
      const inviteToken = searchParams.get('token');

      if (!inviteToken) {
        setStatus('error');
        setMessage('Invalid invitation link');
        return;
      }

      if (!token) {
        // Redirect to login with return URL
        navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      try {
        await acceptInvite(inviteToken, token);
        setStatus('success');
        setMessage('Successfully joined the list!');
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Failed to accept invitation');
      }
    };

    handleInvite();
  }, [searchParams, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Accept Invitation</h2>
          {status === 'loading' && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Processing invitation...</p>
            </div>
          )}
          {status === 'success' && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              <p>{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              <p>{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}