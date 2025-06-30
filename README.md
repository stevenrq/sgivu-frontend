# SGIVU Frontend

A modern Angular 20 frontend application for the SGIVU system, featuring authentication, dashboard functionality, and data visualization capabilities.

## 📚 Documentation

For detailed project documentation, visit: [https://deepwiki.com/stevenrq/sgivu-frontend](https://deepwiki.com/stevenrq/sgivu-frontend)

## 🚀 Features

- **Authentication & Authorization**: OAuth2/OIDC integration with route guards
- **Dashboard**: Interactive data visualization with Chart.js
- **Responsive Design**: Modern UI with component-based architecture
- **Route Protection**: Secure navigation with authentication guards
- **Error Handling**: Custom 404 and Forbidden pages

## 🛠️ Tech Stack

- **Framework**: Angular 20
- **Authentication**: angular-oauth2-oidc
- **Charts**: Chart.js with ng2-charts
- **Styling**: CSS3
- **Testing**: Jasmine & Karma
- **Build Tool**: Angular CLI

## 📁 Project Structure

```
src/
├── app/
│   ├── core/                 # Core services and guards
│   │   ├── guards/          # Authentication guards
│   │   └── services/        # Core services (auth, etc.)
│   ├── features/            # Feature modules
│   │   ├── dashboard/       # Dashboard components
│   │   └── home/           # Home page components
│   └── shared/             # Shared components and utilities
│       ├── components/     # Reusable UI components
│       └── models/         # TypeScript interfaces/models
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Angular CLI

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd sgivu-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. Open your browser and navigate to `http://localhost:4200`

## 📝 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run watch` - Build in watch mode for development
- `npm test` - Run unit tests
- `npm run ng` - Run Angular CLI commands

## 🔐 Authentication

The application uses OAuth2/OIDC for authentication. Protected routes require authentication and will redirect to the authentication provider if the user is not logged in.

### Protected Routes

- `/dashboard` - Requires authentication

### Public Routes

- `/home` - Public home page
- `/forbidden` - Access denied page
- `/404` - Not found page

## 🎯 Components

### Core Components

- **Navbar**: Main navigation component
- **Sidebar**: Side navigation for authenticated users
- **Dashboard**: Main dashboard with data visualization
- **Chart Example**: Reusable chart component using Chart.js

### Shared Components

- **Home**: Landing page component
- **Forbidden**: 403 error page
- **Not Found**: 404 error page

## 🔧 Configuration

### Authentication Configuration

Authentication is configured in `src/app/core/auth-config.ts` and `src/app/core/auth-module-config.ts`.

### Environment Settings

Configure environment-specific settings in the Angular environment files.

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Tests are written using Jasmine and run with Karma. Each component includes corresponding `.spec.ts` test files.

## 🏗️ Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## 📊 Data Visualization

The application includes Chart.js integration for data visualization:

- Interactive charts in the dashboard
- Reusable chart components
- Responsive chart designs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the terms specified in the LICENSE file.

## 🔗 Links

- [Project Documentation](https://deepwiki.com/stevenrq/sgivu-frontend)
- [Angular Documentation](https://angular.io/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

## 🆘 Support

For support and questions, please refer to the project documentation or create an issue in the repository.
