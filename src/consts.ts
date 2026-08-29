import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Yaseen",
  DESCRIPTION:
    "Notes from a developer who over-engineers things on purpose — web, embedded, machine learning, and a self-hosted homelab.",
  EMAIL: "hello@syedyaseen.dev",
  NUM_POSTS_ON_HOMEPAGE: 5,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION:
    "Yaseen writes about web tech, embedded systems, machine learning, and self-hosting — what worked, what broke, and what got fixed in prod.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION:
    "Working notes on Linux, Docker, Rust, Raspberry Pi, and running your own infrastructure.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "Things I have built. Some are open source; the ones I am turning into products are not.",
};

export const TAGS: Metadata = {
  TITLE: "Tags",
  DESCRIPTION: "Browse posts by topic.",
};

export const SOCIALS: Socials = [
  {
    NAME: "GitHub",
    HREF: "https://github.com/syedyaseen",
  },
  {
    NAME: "GitLab",
    HREF: "https://gitlab.com/syedyaseen",
  },
];
