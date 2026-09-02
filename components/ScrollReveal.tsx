"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function ScrollReveal() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const heroItems = gsap.utils.toArray<HTMLElement>("[data-hero-reveal]");
      if (heroItems.length) {
        gsap.from(heroItems, {
          autoAlpha: 0,
          y: 18,
          duration: 0.55,
          ease: "power2.out",
          stagger: 0.1,
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
        const items = group.querySelectorAll<HTMLElement>("[data-reveal-item]");
        if (!items.length) return;

        ScrollTrigger.create({
          trigger: group,
          start: "top 86%",
          once: true,
          onEnter: () => gsap.fromTo(items, { autoAlpha: 0, y: 20 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.08,
            overwrite: "auto",
          }),
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-flow-sequence]").forEach((flow) => {
        const nodes = flow.querySelectorAll<HTMLElement>("[data-flow-item]");
        if (!nodes.length) return;

        ScrollTrigger.create({
          trigger: flow,
          start: "top 88%",
          once: true,
          onEnter: () => gsap.fromTo(nodes, { autoAlpha: 0, x: -10 }, {
            autoAlpha: 1,
            x: 0,
            duration: 0.38,
            ease: "power2.out",
            stagger: 0.07,
            overwrite: "auto",
          }),
        });
      });
    });

    return () => context.revert();
  }, [pathname]);

  return null;
}
