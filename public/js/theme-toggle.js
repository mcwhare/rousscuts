document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // 1. Check local storage first (did they manually click the button before?)
    const savedTheme = localStorage.getItem('theme');
    
    // 2. Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Apply the correct theme on load
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        htmlElement.setAttribute('data-theme', 'dark');
    } else {
        htmlElement.removeAttribute('data-theme');
    }

    // Handle button clicks
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            if (htmlElement.getAttribute('data-theme') === 'dark') {
                htmlElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                htmlElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }
});