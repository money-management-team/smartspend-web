import HomeNavbar from "./components/HomeNavbar";
import HeroSection from "./components/HeroSection";
import FeaturesSection from "./components/FeaturesSection";
import AISection from "./components/AISection";
import StepsSection from "./components/StepsSection";
import SecuritySection from "./components/SecuritySection";
import DashboardPreview from "./components/DashboardPreview";
import FAQSection from "./components/FAQSection";
import HomeFooter from "./components/HomeFooter";

import "./Home.css";

export default function Home() {
  return (
    <div className="home-page">
      <HomeNavbar />

      <main>
        <HeroSection />

        <FeaturesSection />

        <AISection />

        <StepsSection />

        <SecuritySection />

        <DashboardPreview />

        <FAQSection />
      </main>

      <HomeFooter />
    </div>
  );
}