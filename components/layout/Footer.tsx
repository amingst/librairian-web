import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="footer-container">
        <p>© {currentYear} LIBRΛIRIΛN. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer; 