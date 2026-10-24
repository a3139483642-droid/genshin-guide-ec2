import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './app.jsx';
import './style.css';
import './frontend.css';
import './admin-refresh.css';
import './secondary-theme.css';
import './teyvat-theme.css';
import './travel-art.css';
import './image-guide.css';

createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
