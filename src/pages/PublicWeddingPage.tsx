import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPublicInvitationBySlug } from '../services/weddingService';
import { InvitationDoc } from '../types/wedding';
import { InvitationRenderer } from '../components/InvitationRenderer';

export function PublicWeddingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const guestName = searchParams.get('to') || searchParams.get('guest') || undefined;
  const { user } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAvailableReason, setNotAvailableReason] = useState<'not-found' | 'draft' | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotAvailableReason('not-found');
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setNotAvailableReason(null);

    getPublicInvitationBySlug(slug)
      .then((doc) => {
        if (!mounted) return;
        if (!doc) {
          setNotAvailableReason('not-found');
          setInvitation(null);
        } else if (doc.status !== 'published' && doc.ownerId !== user?.uid) {
          setNotAvailableReason('draft');
          setInvitation(null);
        } else {
          setInvitation(doc);
          document.title = `${doc.groomData.nickname || 'Groom'} & ${
            doc.brideData.nickname || 'Bride'
          } — WEDLINK Invitation`;
        }
      })
      .catch(() => {
        if (mounted) {
          setNotAvailableReason('not-found');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug, user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <p className="font-cormorant text-3xl text-[#443C35] mb-2">WEDLINK</p>
        <p className="text-xs tracking-widest uppercase text-[#737C68]">
          Preparing your wedding invitation...
        </p>
      </div>
    );
  }

  if (!invitation || notAvailableReason) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#443C35] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E5DDD0] rounded-2xl p-8 text-center space-y-4">
          <p className="font-cormorant text-2xl font-semibold tracking-wider">WEDLINK</p>
          <h1 className="font-cormorant text-3xl font-medium">
            {notAvailableReason === 'draft'
              ? 'This invitation is still in draft'
              : 'Wedding invitation not found'}
          </h1>
          <p className="text-sm text-[#443C35]/75 leading-relaxed">
            {notAvailableReason === 'draft'
              ? 'The couple is still preparing their wedding website. Please check back once they publish it.'
              : 'The wedding URL you opened may have changed or is not published yet.'}
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-[#443C35] text-white text-xs font-medium rounded-lg"
          >
            Visit WEDLINK Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {invitation.status !== 'published' && (
        <div className="bg-[#443C35] text-[#FAF7F2] text-xs py-2 px-4 text-center">
          Owner Draft Preview — Publish this invitation in your Studio Editor so guests can view it publicly.
        </div>
      )}
      <InvitationRenderer invitation={invitation} guestName={guestName} />
    </div>
  );
}
