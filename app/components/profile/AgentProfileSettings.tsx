'use client';

import { useState, useEffect } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import { getFrontEndUser } from '@/app/utils/aws/auth/amplifyFrontEndUser';
import { HiOutlineUserCircle } from 'react-icons/hi2';
import { useAccess } from '@/app/context/AccessContext';
import Link from 'next/link';

export default function AgentProfileSettings() {
  const { hasPaidPlan } = useAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<any>(null);
  const [agentName, setAgentName] = useState('');
  const [agentBrokerage, setAgentBrokerage] = useState('');
  const [agentCalendarEmail, setAgentCalendarEmail] = useState('');
  const [aiPersona, setAiPersona] = useState('');
  const [aiExamples, setAiExamples] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await getFrontEndUser();
      if (!user) return;

      const { data: integrations } = await client.models.GhlIntegration.list({
        filter: {
          userId: { eq: user.userId },
          isActive: { eq: true }
        }
      });

      if (integrations && integrations.length > 0) {
        const userIntegration = integrations[0];
        setIntegration(userIntegration);
        setAgentName(userIntegration.agentName || '');
        setAgentBrokerage(userIntegration.agentBrokerage || '');
        setAgentCalendarEmail(userIntegration.agentCalendarEmail || '');
        setAiPersona(userIntegration.aiPersona || '');
        setAiExamples(userIntegration.aiExamples || '');
      }
    } catch (error) {
      console.error('Error loading agent profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!integration) return;

    setSaving(true);
    try {
      await client.models.GhlIntegration.update({
        id: integration.id,
        agentName: agentName || null,
        agentBrokerage: agentBrokerage || null,
        agentCalendarEmail: agentCalendarEmail || null,
        aiPersona: aiPersona || null,
        aiExamples: aiExamples || null,
      });

      alert('Agent profile saved!');
    } catch (error) {
      console.error('Error saving agent profile:', error);
      alert('Failed to save agent profile');
    } finally {
      setSaving(false);
    }
  };

  if (!hasPaidPlan) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
          <HiOutlineUserCircle className="text-indigo-500" /> Agent Profile
        </h3>
        <p className="text-slate-500 text-sm mb-4">A Sync Plan is required to configure your agent profile for outreach messages.</p>
        <Link
          href="/pricing"
          className="inline-block bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Upgrade to Sync Plan
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
          <HiOutlineUserCircle className="text-indigo-500" /> Agent Profile
        </h3>
        <p className="text-slate-600">Please connect your Launch AI system first.</p>
      </div>
    );
  }

  const isProfileIncomplete = !agentName || !agentBrokerage;

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
      <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
        <HiOutlineUserCircle className="text-indigo-500" /> Agent Profile
      </h3>
      <p className="text-slate-500 text-sm mb-6">
        Your name and brokerage appear in all SMS messages and AI-generated outreach.
      </p>

      {isProfileIncomplete && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 text-amber-500 font-black">!</span>
          <span>Add your name and brokerage so outreach messages are personalized to you — otherwise leads will receive generic messages.</span>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Your full name as it appears in SMS messages (e.g. "Hi, this is Jane with Keller Williams…")
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Brokerage <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={agentBrokerage}
            onChange={(e) => setAgentBrokerage(e.target.value)}
            placeholder="Keller Williams"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Your brokerage name as it appears in messages
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Google Calendar Email <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={agentCalendarEmail}
            onChange={(e) => setAgentCalendarEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Google Calendar email for AI-booked appointments. Leave blank to skip calendar sync.
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <h4 className="text-sm font-black text-slate-900 mb-1 mt-4">AI Voice <span className="text-slate-400 font-normal">(optional)</span></h4>
          <p className="text-xs text-slate-500 mb-4">
            Shape how the AI sounds when it <strong>replies to leads</strong>. These do not change your
            cold-outreach text messages.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Your Style / Persona
            </label>
            <textarea
              value={aiPersona}
              onChange={(e) => setAiPersona(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="e.g. Warm and casual, never pushy. Lead with the homeowner's situation, not a sales pitch. Use short texts, contractions, and a little humor. Avoid jargon and never give legal or tax advice."
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              A short guide to your tone and do's/don'ts. {aiPersona.length}/1000 characters.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Example Replies
            </label>
            <textarea
              value={aiExamples}
              onChange={(e) => setAiExamples(e.target.value.slice(0, 2000))}
              rows={6}
              placeholder={'Paste 3-5 of your best real replies so the AI can mimic your voice, e.g.\nLead: how did you get my number?\nYou: fair question — it’s from public county records, nothing private. happy to explain.\nLead: not interested\nYou: totally understand, I’ll leave you be. if anything changes down the road just reach out.'}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              A few real replies the AI should imitate (not copy verbatim). {aiExamples.length}/2000 characters.
            </p>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Agent Profile'}
        </button>
      </div>
    </div>
  );
}
