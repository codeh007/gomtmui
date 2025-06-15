import React from 'react';
import article from '../data/article.json';

const HomePage = () => {
  return (
    <div className="container">
      <h1>{article.title}</h1>
      <div className="article-meta">
        <p>By: {article.author}</p>
        <p>Date: {article.date}</p>
      </div>
      {/* Split content into paragraphs for better readability */}
      {article.content.split('\\n').map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
};

export default HomePage;
