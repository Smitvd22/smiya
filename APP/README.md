# Smiya Mobile App

A React Native/Expo mobile application for the Smiya platform that allows users to chat, make video calls, manage friends, and enjoy birthday wishes.

## Features

- User authentication (login/register)
- Real-time chat with friends
- Photo sharing in chats
- Video calls
- Friend management (add/accept/reject)
- Profile management
- Special birthday wishes screen

## Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- Expo CLI
- Android Studio or Xcode (for emulators)

### Installation

1. Clone the repository
2. Navigate to the APP directory
3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm start
```

5. Follow the instructions in the terminal to open the app on:
   - iOS simulator
   - Android emulator
   - Your physical device using the Expo Go app

### Environment Configuration

The app uses `app.config.js` for configuration. For local development:

- Set your development server IP in the `DEV_SERVER_IP` environment variable
- Or modify the `devServerIp` in `app.config.js` directly

## Project Structure

```
APP/
├── assets/               # Static assets (images, etc.)
│   └── placeholder/      # Placeholder assets for development
├── src/
│   ├── assets/           # Application-specific assets
│   ├── components/       # Reusable UI components
│   ├── config/           # Configuration files
│   ├── contexts/         # React context providers
│   │   ├── AuthContext.js      # Authentication context
│   │   ├── CallContext.js      # Video call management
│   │   └── SocketContext.js    # WebSocket connections
│   ├── hooks/            # Custom React hooks
│   ├── navigation/       # Navigation configuration
│   │   └── AppNavigator.js     # Main navigation setup
│   ├── screens/          # App screens
│   │   ├── BirthdayWishScreen.js
│   │   ├── ChatListScreen.js
│   │   ├── ChatScreen.js
│   │   ├── FriendsScreen.js
│   │   ├── HomeScreen.js
│   │   ├── IncomingCallScreen.js
│   │   ├── LandingScreen.js
│   │   ├── LoginScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── RegisterScreen.js
│   │   └── VideoCallScreen.js
│   ├── services/         # API and other external services
│   │   └── authService.js      # Authentication API
│   ├── styles/           # Global styles
│   └── utils/            # Utility functions
├── App.js                # Main app component
├── app.config.js         # Expo configuration
└── package.json          # Dependencies
```

## Running on a Physical Device

1. Install the Expo Go app on your device
2. Make sure your device and computer are on the same network
3. Start the development server with `npm start`
4. Scan the QR code with:
   - iOS: Camera app
   - Android: Expo Go app

## Building for Production

1. Create an Expo account if you don't have one
2. Configure EAS Build by running:

```bash
eas build:configure
```

3. Build for preview:

```bash
npm run build:preview
```

4. Build for production:

```bash
npm run build:prod
```

## Troubleshooting

- **Network Issues**: Ensure your device and computer are on the same network, or use a tunnel connection with `expo start --tunnel`
- **Missing Dependencies**: If you encounter errors, try running `npm install` again and restart the development server
- **Permissions**: Ensure the app has the necessary permissions on your device (camera, microphone, storage)
- **Socket Connection**: If real-time features aren't working, verify the server is running and the API URL is correct in `app.config.js`

## License

[MIT License](LICENSE)
