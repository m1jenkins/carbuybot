"use client";

import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    document.documentElement.classList.add("js");

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>(".rv"),
    );
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      revealElements.forEach((element) => element.classList.add("in"));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
      );
      revealElements.forEach((element) => revealObserver.observe(element));
      cleanups.push(() => revealObserver.disconnect());
    }

    const header = document.getElementById("hdr");
    const hero = document.getElementById("top");
    const mobileCta = document.getElementById("mcta");
    const end = document.getElementById("start");
    const plates = reducedMotion
      ? []
      : Array.from(
          document.querySelectorAll<HTMLElement>(
            ".hero .plate__media, .close .plate__media",
          ),
        );
    let endVisible = false;
    let animationFrame = 0;

    const frame = () => {
      animationFrame = 0;
      if (!header || !hero || !mobileCta) return;

      header.classList.toggle(
        "is-solid",
        hero.getBoundingClientRect().bottom <= 70,
      );
      mobileCta.classList.toggle(
        "show",
        window.scrollY > 560 && !endVisible,
      );

      plates.forEach((plate) => {
        const section = plate.parentElement?.getBoundingClientRect();
        if (
          !section ||
          section.bottom < -240 ||
          section.top > window.innerHeight + 240
        ) {
          return;
        }
        const progress =
          (section.top + section.height / 2 - window.innerHeight / 2) /
          window.innerHeight;
        plate.style.transform = `translate3d(0,${(progress * -34).toFixed(2)}px,0) scale(1.07)`;
      });
    };
    const schedule = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(frame);
      }
    };

    if (
      end &&
      typeof IntersectionObserver !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      const endObserver = new IntersectionObserver(
        ([entry]) => {
          endVisible = entry.isIntersecting;
          schedule();
        },
        { threshold: 0.12 },
      );
      endObserver.observe(end);
      cleanups.push(() => endObserver.disconnect());
    }
    if (typeof window.requestAnimationFrame === "function") {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
      });
    }
    frame();

    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    const thread = document.getElementById("hero-demo");
    if (thread) {
      const beats = Array.from(
        thread.querySelectorAll<HTMLElement>("[data-beat]"),
      );
      const composeRows = Array.from(
        thread.querySelectorAll<HTMLElement>("[data-compose]"),
      );
      let timers: number[] = [];
      let started = false;
      let onStage = false;

      const clearTimers = () => {
        timers.forEach((timer) => window.clearTimeout(timer));
        timers = [];
      };
      const later = (callback: () => void, delay: number) => {
        timers.push(window.setTimeout(callback, delay));
      };
      const wipe = () => {
        clearTimers();
        started = false;
        beats.forEach((beat) => beat.classList.remove("is-in"));
        composeRows.forEach((row) => row.classList.remove("is-in"));
      };
      const showAll = () => {
        clearTimers();
        beats.forEach((beat) => beat.classList.add("is-in"));
        composeRows.forEach((row) => row.classList.remove("is-in"));
      };
      const play = () => {
        if (reducedMotion) {
          showAll();
          return;
        }
        if (started || beats.length < 4 || composeRows.length < 2) return;
        wipe();
        started = true;
        later(() => beats[0].classList.add("is-in"), 320);
        later(() => composeRows[0].classList.add("is-in"), 1480);
        later(() => {
          composeRows[0].classList.remove("is-in");
          beats[1].classList.add("is-in");
        }, 2480);
        later(() => beats[2].classList.add("is-in"), 4300);
        later(() => composeRows[1].classList.add("is-in"), 5750);
        later(() => {
          composeRows[1].classList.remove("is-in");
          beats[3].classList.add("is-in");
        }, 6700);
      };

      let threadObserver: IntersectionObserver | undefined;
      if (reducedMotion || typeof IntersectionObserver === "undefined") {
        showAll();
      } else {
        threadObserver = new IntersectionObserver(
          ([entry]) => {
            onStage = entry.isIntersecting;
            if (onStage) play();
            else wipe();
          },
          { threshold: 0.28 },
        );
        threadObserver.observe(thread);
      }

      const handleVisibility = () => {
        if (document.hidden) {
          clearTimers();
        } else if (onStage) {
          started = false;
          play();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      cleanups.push(() => {
        clearTimers();
        threadObserver?.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
