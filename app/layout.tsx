import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

const description =
  "Tell us the car you want. Your agent emails every dealer that has one, negotiates the out-the-door price with all of them at once, and sends you the offers to compare. $349 flat. If it doesn't save you more than that, you pay nothing.";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "ProfessionalService"],
      "@id": "https://carbuyerbots.com/#org",
      name: "CarBuyerBots",
      url: "https://carbuyerbots.com/",
      logo: "https://carbuyerbots.com/logo.svg",
      description:
        "A car buying service that negotiates for you. Your agent finds the car at dealers near you, emails all of them, and negotiates the out-the-door price on your behalf.",
      areaServed: { "@type": "Country", name: "United States" },
      priceRange: "$349",
      knowsAbout: [
        "car buying service",
        "car price negotiation",
        "new cars",
        "used cars",
        "out-the-door pricing",
      ],
    },
    {
      "@type": "Product",
      name: "CarBuyerBots AI Car Buying Agent",
      description:
        "An AI buying agent that finds your car at nearby dealers, negotiates with all of them at the same time, and collects trade-in and financing quotes until you approve a final out-the-door price.",
      brand: { "@id": "https://carbuyerbots.com/#org" },
      url: "https://carbuyerbots.com/",
      offers: {
        "@type": "Offer",
        price: "349.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://carbuyerbots.com/#pricing",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Do dealers know they're talking to an AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Your agent gives its name, says it is buying on your behalf, and says it is an AI. We do not pretend to be you. Most dealers keep negotiating anyway, because they still want the sale.",
          },
        },
        {
          "@type": "Question",
          name: "Who actually buys the car?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You do. The agent negotiates and gathers paperwork, but you review the final numbers and you sign. We never take title to a car and we never hold your money.",
          },
        },
        {
          "@type": "Question",
          name: "Is this like a car broker?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A broker charges $500 to $2,500 and usually works one dealer relationship at a time. Your agent costs $349 and works every dealer at the same time. Brokers are sometimes paid by the dealer too. We are paid only by you.",
          },
        },
        {
          "@type": "Question",
          name: "Do you handle new and used cars?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Both, as long as the car is listed by a licensed dealer. We do not handle private party sales.",
          },
        },
        {
          "@type": "Question",
          name: "What about my trade-in and financing?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your agent gathers payoff quotes and lender options while it negotiates the car, so you can judge the deal on total out-the-door cost instead of a monthly payment.",
          },
        },
        {
          "@type": "Question",
          name: "Is my information private?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your details are used only to run your negotiation. Never sold, never shared with dealers beyond what a purchase requires.",
          },
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://carbuyerbots.com"),
  title: "CarBuyerBots | A bot that haggles with car dealers for you",
  description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    title: "CarBuyerBots | Let a bot haggle for your next car",
    description:
      "Your agent emails every dealer that has your car and negotiates all of them at the same time. You compare the offers and sign. $349 flat, refunded if it doesn't save you more.",
    images: ["/og.jpg"],
    siteName: "CarBuyerBots",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarBuyerBots | Let a bot haggle for your next car",
    description:
      "Your agent negotiates with every dealer that has your car at the same time. You compare out-the-door prices and sign. $349 flat.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='%230C0D0C'/><g stroke='%23F2F1EE' stroke-width='1.6' fill='none' stroke-linecap='round'><circle cx='12' cy='12' r='6.4'/><path d='M12 14.3V18.4M9.8 12H5.6M14.2 12h4.2'/></g><circle cx='12' cy='12' r='1.6' fill='%23F2F1EE'/></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#0C0D0C",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="preload"
          as="image"
          href="/media/hero-wide.jpg"
          media="(min-width:721px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/media/hero.jpg"
          media="(max-width:720px)"
          fetchPriority="high"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
