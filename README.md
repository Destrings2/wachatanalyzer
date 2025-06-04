# WhatsApp Chat Analyzer

[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3.5-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.8-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A beautiful, privacy-first web application for analyzing your WhatsApp chat exports. Get insights into your conversations with interactive visualizations, activity patterns, emoji usage, and much more!

![image](https://github.com/user-attachments/assets/e623b153-efda-471b-8943-b4b0301130fc)


## Features

### **Comprehensive Analytics**
- **Message Statistics** - Total messages, media shared, response patterns
- **Activity Patterns** - Hourly, daily, weekly, and monthly activity heatmaps
- **Word Analysis** - Word clouds, frequency analysis, vocabulary richness
- **Emoji Insights** - Most used emojis, emoji trends, sender preferences
- **Call Analytics** - Call duration, patterns, missed vs completed calls
- **Response Metrics** - Average response times, conversation initiators

### **Interactive Visualizations**
- **Activity Heatmap** - Calendar-style activity visualization
- **Radial Activity Clock** - 24-hour activity patterns
- **Word Cloud** - Interactive word frequency visualization
- **Timeline Charts** - Message activity over time
- **Emoji Analysis** - Visual emoji usage breakdowns

### **Modern User Experience**
- **Dark Mode** - Beautiful dark/light theme support
- **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- **Real-time Search** - Advanced search with Boolean operators
- **Virtual Scrolling** - Smooth performance with large chat histories
- **Progressive Loading** - Web Workers for non-blocking data processing

### *Privacy First**
- **100% Client-Side** - Your data never leaves your device
- **No Server Required** - Runs entirely in your browser
- **No Data Collection** - We don't store or track anything
- **Open Source** - Full transparency in code and data handling

## Quick Start

### Online Demo
Visit [WhatsApp Chat Analyzer](https://your-deployment-url.com) to try it immediately with your chat export.

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chatanalyzer.git
   cd chatanalyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

##  How to Export Your WhatsApp Chat

### On Mobile:
1. Open the chat in WhatsApp
2. Tap the menu (�) and select **"More"**
3. Choose **"Export chat"**
4. Select **"Without media"**
5. Save the `.txt` file and upload it to the analyzer

### On Desktop:
1. Open WhatsApp Web/Desktop
2. Select the chat you want to analyze
3. Click the menu (�) � **"More"** � **"Export chat"**
4. Choose **"Without media"**
5. Save and upload the file

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Styling**: TailwindCSS 4 with custom design system
- **Visualizations**: D3.js for interactive charts
- **State Management**: Zustand for lightweight state handling
- **Performance**: Web Workers for heavy data processing
- **Virtual Scrolling**: @tanstack/react-virtual for large datasets
- **Build Tool**: Vite for fast development and building
- **Testing**: Vitest with React Testing Library

## Advanced Features

### **Powerful Search**
```
# Search examples:
hello AND world          # Both terms must be present
"exact phrase"            # Find exact phrases
sender:john meeting       # Messages from John containing "meeting"
type:media (photo OR video) # Media messages with specific types
hello -goodbye            # Contains "hello" but not "goodbye"
```

### **Analytics Modes**
- **Overview** - Key statistics and participant summaries
- **Activity Timeline** - Message patterns over time
- **Activity Clock** - 24-hour activity visualization
- **Call Analysis** - Voice and video call insights
- **Activity Heatmap** - Calendar-style activity view
- **Word Cloud** - Most frequently used words
- **Emoji Analysis** - Emoji usage patterns
- **Response Patterns** - Conversation flow analysis

### **Customization Options**
- Filter by date ranges, participants, and message types
- Toggle between individual and aggregated views
- Export insights as images or data files
- Responsive layouts for all screen sizes

## Contributing

We welcome contributions! Whether it's bug fixes, new features, or improvements to documentation.

### Development Setup

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm run test
   npm run lint
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (ESLint + TypeScript)
- Add tests for new features
- Update documentation as needed
- Ensure mobile responsiveness
- Test with large chat files
- Maintain privacy-first principles

## Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

##  Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.


##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

