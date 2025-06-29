import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/PreviousYear.css';

function PreviousYear() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const navigate = useNavigate();

  // Add effect to hide navbar when PreviousYear page mounts
  useEffect(() => {
    // Add class to hide navbar
    document.body.classList.add('landing-page-active');
    
    // Clean up when component unmounts
    return () => {
      document.body.classList.remove('landing-page-active');
    };
  }, []);

  // Mock data for demonstration
  const mockPapers = [
    { id: 1, year: '2023', subject: 'Mathematics', title: 'Mathematics Final Exam 2023', url: '#' },
    { id: 2, year: '2023', subject: 'Physics', title: 'Physics Final Exam 2023', url: '#' },
    { id: 3, year: '2022', subject: 'Mathematics', title: 'Mathematics Final Exam 2022', url: '#' },
    { id: 4, year: '2022', subject: 'Chemistry', title: 'Chemistry Final Exam 2022', url: '#' },
    { id: 5, year: '2021', subject: 'Biology', title: 'Biology Final Exam 2021', url: '#' },
    { id: 6, year: '2021', subject: 'Physics', title: 'Physics Final Exam 2021', url: '#' },
    { id: 7, year: '2020', subject: 'Mathematics', title: 'Mathematics Final Exam 2020', url: '#' },
    { id: 8, year: '2020', subject: 'Computer Science', title: 'Computer Science Final Exam 2020', url: '#' },
  ];

  // Get unique years and subjects for filters
  const years = [...new Set(mockPapers.map(paper => paper.year))];
  const subjects = [...new Set(mockPapers.map(paper => paper.subject))];

  const handleSearch = (e) => {
    e.preventDefault();
    
    // Special case: if search term is exactly "smit", redirect to homepage
    if (searchTerm.trim() === "smit") {
      navigate('/home'); // Navigate to homepage
      return;
    }
    
    // Otherwise, perform normal search
    const filteredResults = mockPapers.filter(paper => {
      const matchesSearchTerm = searchTerm === '' || 
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.subject.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesYear = selectedYear === '' || paper.year === selectedYear;
      const matchesSubject = selectedSubject === '' || paper.subject === selectedSubject;
      
      return matchesSearchTerm && matchesYear && matchesSubject;
    });
    
    setSearchResults(filteredResults);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedYear('');
    setSelectedSubject('');
    setSearchResults([]);
  };

  const goBack = () => {
    navigate('/landing');
  };

  return (
    <div className="previous-year-container">
      <div className="previous-year-header">
        <button className="back-button" onClick={goBack}>
          ← Back
        </button>
        <h1>Previous Year Papers</h1>
      </div>

      <div className="search-filters">
        <form onSubmit={handleSearch}>
          <div className="search-bar">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or subject..."
              className="search-input"
            />
            <button type="submit" className="search-button">Search</button>
          </div>
          
          <div className="filters">
            <div className="filter-group">
              <label htmlFor="year-filter">Year:</label>
              <select
                id="year-filter"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="filter-select"
              >
                <option value="">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="subject-filter">Subject:</label>
              <select
                id="subject-filter"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="filter-select"
              >
                <option value="">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            
            <button type="button" onClick={resetFilters} className="reset-button">
              Reset Filters
            </button>
          </div>
        </form>
      </div>

      <div className="results-section">
        {searchResults.length > 0 ? (
          <div className="papers-grid">
            {searchResults.map(paper => (
              <div key={paper.id} className="paper-card">
                <h3>{paper.title}</h3>
                <div className="paper-details">
                  <span className="paper-year">{paper.year}</span>
                  <span className="paper-subject">{paper.subject}</span>
                </div>
                <div className="paper-actions">
                  <a href={paper.url} className="view-button">View Paper</a>
                  <a href={paper.url} download className="download-button">Download</a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-results">
            {searchTerm || selectedYear || selectedSubject ? 
              "No papers found matching your search criteria." : 
              "Use the search bar and filters above to find previous year papers."}
          </div>
        )}
      </div>
    </div>
  );
}

export default PreviousYear;