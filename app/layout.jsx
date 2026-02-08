import './globals.css';

export const metadata = {
    title: 'Operational DB Fleet Optimizer | Cost Optimization Prioritizer',
    description: 'AI-powered fleet-wide database cost optimization and prioritization tool',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>{children}</body>
        </html>
    );
}
