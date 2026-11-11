import { NavLink, Route, Routes } from 'react-router-dom'
import { ClaimPage } from './pages/ClaimPage'
import { ListingPage } from './pages/ListingPage'
import { NeedsPage } from './pages/NeedsPage'
import { CompareTray } from './components/CompareTray'
import { ComparePage } from './pages/ComparePage'
import { Home } from './pages/Home'
import { AboutPage } from './pages/AboutPage'
import { ResearchPage } from './pages/ResearchPage'
import { Report } from './pages/Report'

export default function App() {
  return (
    <>
      <header className="topbar"><nav className="in" aria-label="Primary">
        <NavLink to="/" className="brand" end>LapFit</NavLink>
        <NavLink to="/needs">My needs</NavLink>
        <NavLink to="/" end>Find laptops</NavLink>
        <NavLink to="/listing">Check a listing</NavLink>
        <NavLink to="/claim">Check a claim</NavLink>
        <NavLink to="/compare">Compare</NavLink>
      </nav></header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/laptops/:id" element={<Report />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/research/:id" element={<ResearchPage />} />
          <Route path="/claim" element={<ClaimPage />} />
          <Route path="/listing" element={<ListingPage />} />
          <Route path="/needs" element={<NeedsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<div className="page"><h1>Page not found</h1></div>} />
        </Routes>
      </main>
      <footer className="footer">LapFit helps you decide; it never says “buy this”. <NavLink to="/about">How it works and how far to trust it</NavLink></footer>
      <CompareTray />
    </>
  )
}
