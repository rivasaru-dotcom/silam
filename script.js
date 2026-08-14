document.addEventListener("DOMContentLoaded", () => {
    // AOS animations
    if (typeof AOS !== "undefined") {
        AOS.init({
            duration: 800,
            once: true,
            offset: 70
        });
    }

    // Navbar scroll state
    const nav = document.querySelector(".custom-nav");
    const updateNavbar = () => {
        if (nav) nav.classList.toggle("scrolled", window.scrollY > 40);
    };
    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });

    // Close mobile Bootstrap menu after navigation
    const menu = document.getElementById("menu");
    document.querySelectorAll(".navbar-nav .nav-link, .navbar-nav .custom-btn").forEach(link => {
        link.addEventListener("click", () => {
            if (menu && typeof bootstrap !== "undefined") {
                const collapse = bootstrap.Collapse.getInstance(menu);
                if (collapse) collapse.hide();
            }
        });
    });

    // Back-to-top button
    const scrollTop = document.getElementById("scrollTop");
    const updateScrollButton = () => {
        if (scrollTop) scrollTop.classList.toggle("show", window.scrollY > 500);
    };
    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });

    if (scrollTop) {
        scrollTop.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    // Footer year
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    // Animated statistics
    const counters = document.querySelectorAll(".counter");
    const statsSection = document.querySelector(".stats");
    let countersStarted = false;

    const startCounters = () => {
        if (countersStarted || !statsSection || !counters.length) return;

        const rect = statsSection.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            countersStarted = true;

            counters.forEach(counter => {
                const target = Number(counter.dataset.target) || 0;
                const duration = 1300;
                const start = performance.now();

                const animate = now => {
                    const progress = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    counter.textContent = Math.floor(target * eased).toLocaleString();

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        counter.textContent = target.toLocaleString();
                    }
                };

                requestAnimationFrame(animate);
            });
        }
    };

    startCounters();
    window.addEventListener("scroll", startCounters, { passive: true });

    // Contact form: client-side validation only.
    // Replace the success block with your real API/CRM endpoint before launch.
    const form = document.getElementById("contactForm");
    const status = document.getElementById("formStatus");

    if (form) {
        form.addEventListener("submit", event => {
            event.preventDefault();

            if (!form.checkValidity()) {
                form.classList.add("was-validated");
                if (status) status.textContent = "Please complete all fields with valid details.";
                return;
            }

            const data = new FormData(form);
            const name = String(data.get("name") || "").trim();

            if (status) {
                status.textContent = `Thanks, ${name}. Your details are ready to be connected to the SILAM Finance CRM/email workflow.`;
            }

            form.reset();
            form.classList.remove("was-validated");
        });
    }
});
