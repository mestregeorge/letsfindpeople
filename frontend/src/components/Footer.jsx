import { useState } from 'react';
import logo from "../assets/logo.png";

import "./Footer.css";

export default function Footer() {
  const [paragraphHtml, setParagraphHtml] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const loadPolicy = (fileName, title) => {
    setModalTitle(title);
    fetch(`policies/${fileName}.html`)
      .then(response => response.text())
      .then(html => setParagraphHtml(html))
      .catch(error => console.error('Error loading policy:', error));
  };

  return (
    <>
      <footer className="footer">
        {/* Logo */}
        <img
          src={logo}
          alt="Logo"
          style={{ height: '100px', display: 'block', margin: '0 auto 20px' }}
        />

        {/* Policy Links */}
        <div>
          <a
            href="#"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
            onClick={(e) => {
              e.preventDefault();
              loadPolicy('privacy', 'Privacy Policy');
            }}
            style={{ color: 'white', margin: '0 10px' }}
          >
            Privacy Policy
          </a>
          <a
            href="#"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
            onClick={(e) => {
              e.preventDefault();
              loadPolicy('terms', 'Terms & Conditions');
            }}
            style={{ color: 'white', margin: '0 10px' }}
          >
            Terms & Conditions
          </a>
          <a
            href="#"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
            onClick={(e) => {
              e.preventDefault();
              loadPolicy('cookies', 'Cookies Policy');
            }}
            style={{ color: 'white', margin: '0 10px' }}
          >
            Cookies
          </a>
          <a
            href="#"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
            onClick={(e) => {
              e.preventDefault();
              loadPolicy('refunds', 'Refunds Policy');
            }}
            style={{ color: 'white', margin: '0 10px' }}
          >
            Refunds
          </a>
          <a
            href="#"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
            onClick={(e) => {
              e.preventDefault();
              loadPolicy('contacts', 'Contact Information');
            }}
            style={{ color: 'white', margin: '0 10px' }}
          >
            Contact
          </a>
        </div>
      </footer>

      <div
        className="modal fade"
        id="exampleModal"
        tabIndex="-1"
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="exampleModalLabel">
                {modalTitle}
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div
              className="modal-body"
              dangerouslySetInnerHTML={{ __html: paragraphHtml }}
            ></div>
          </div>
        </div>
      </div>
    </>
  );
}