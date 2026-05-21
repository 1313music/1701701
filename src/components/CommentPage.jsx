import React from 'react';
import CommentSection from './CommentSection.jsx';

const CommentPage = ({ serverURL }) => (
  <div className="comment-page">
    <img
      className="comment-hero"
      src="https://p1.music.126.net/Oesc8Giq7mS3snCssN1Pbg==/109951172866178321.jpg"
      alt="留言板"
      loading="lazy"
      decoding="async"
    />
    <CommentSection
      serverURL={serverURL}
      path="page:guestbook"
      title="一壶浊酒尽余欢 今宵别梦寒"
    />
  </div>
);

export default CommentPage;
