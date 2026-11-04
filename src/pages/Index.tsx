import { useState, useEffect } from "react";
import { BootScreen } from "@/components/desktop/BootScreen";
import { Window } from "@/components/desktop/Window";
import { AsciiFight } from "@/components/desktop/AsciiFight";
import { Github, Linkedin, Mail, Twitter, FolderGit2, MessageCircle, HelpCircle, Link as LinkIcon, User, Newspaper, Plus, Gamepad2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import blogMascot from "@/assets/blog-mascot.jpeg";

type AppId = "main" | "contact" | "projects" | "links" | "faqs" | "more-faqs" | "josetube" | "about" | "blog" | "game" | `project:${string}`;

type BlogBlock =
  | { type: "text"; body: string }
  | { type: "image"; url: string; alt?: string; full?: boolean; caption?: string }
  | { type: "video"; url: string };

interface BlogPost {
  id: string;
  title: string;
  content: BlogBlock[];
  createdAt: string;
}

interface VideoMeta {
  title: string;
  src: string;
  poster: string;
  channel: string;
  views: string;
  uploaded: string;
  description: string;
}

interface OpenWindow {
  id: AppId;
  z: number;
}

const makePoster = (label: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#g)"/>
    <circle cx="640" cy="360" r="78" fill="#f8fafc" opacity="0.95"/>
    <polygon points="620,320 620,400 695,360" fill="#111827"/>
    <text x="640" y="490" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#e5e7eb">
      ${label}
    </text>
  </svg>`,
)}`;

const PROJECTS = [
  {
    slug: "kubernetes",
    name: "homelabCD",
    desc: "one command to turn a few ubuntu servers into a highly available kubernetes homelab, managed through gitops.",
    body: [
      "After acquiring an old laptop I wanted to get into setting up a Kubernetes cluster. I've been more interested in redundancy, as I've had a lot of issues with my current setup. I'll also mention I wanted to learn about this since redundancy is a pillar of networking.",
      "The idea that your software survives even if your hardware fails was essential to integrate into my setup. I want high availability and POWERRR. So my ideal setup is 4 computers, 2 worker nodes, 2 control planes, but I want one of the control planes to run workloads too. That way I have more power, but still have an extra control plane in case one of them fails.",
      "I already had a general understanding of Kubernetes, simply put; an orchestration of containers, like docker, across multiple computers. The way I wanted to learn was through making Infrastructure as Code. A combination of deployment through script, control through yaml, and GitOps for easy backups, updates, rollbacks, upgrades, and a lot more you get with Kubernetes/containerization.",
      "The first part was figuring out what I wanted it to look like, what I wanted it to do, and what I wanted it to use. So I created a bootstrapper, a control plane initializer, a worker node initializer, and a couple other options. That script grew into homelabCD.",
      "How it works now: on a fresh Ubuntu Server 24.04 machine you run sudo ./install.sh and choose Bootstrap New Cluster. It asks a few questions once (domain, MetalLB IP range, GitOps repo, optional Longhorn disk and WireGuard VPN), then goes step by step: validates the host, preps the OS, installs containerd, kubeadm/kubelet/kubectl, sets up kube-vip, runs kubeadm init, installs Cilium, Helm, and Argo CD, and finally hooks the cluster up to my own GitHub repo. You can even pause after each step to check what it did.",
      "What gets installed: kube-vip gives the API server a virtual IP so the cluster survives losing a control plane, MetalLB hands out LAN IPs, ingress-nginx and cert-manager give every web UI its own HTTPS address with Let's Encrypt, and Longhorn keeps copies of each volume on different nodes so an app starts back up somewhere else if a node goes down. On top of that I've got DuckDNS, a WireGuard VPN, PostgreSQL with pgAdmin, Rancher, and Hermes, an AI agent with a local LLM option.",
      "The GitOps part is my favorite. After the bootstrap, Argo CD keeps the cluster in sync with my repo, so if I want to change what's running I just commit and push. Adding nodes is easy too. The join credentials get encrypted with age and pushed to a private bootstrap repo, so new nodes can join from a menu (or remotely over SSH) without me copying secrets around by hand.",
      "200+ commits later it handles way more than I planned: health checks, OS updates with safe reboots, moving app storage between Longhorn and a node's disk, cleaning up stuck pods, and decommissioning nodes. All of it runs from KubesTUI, the terminal UI I built for it (check it out in my projects).",
    ],
    video: {
      src: `/testfoootage.mp4`,
      poster: `/desktopimg.png`,
      duration: "0:09",
    },
  },
  {
    slug: "wdc-lab",
    name: "Windows Domain Controller Lab",
    desc: "Creating a 'New Forest', documenting my proccess",
    body: [
      "I wanted to simulate working help desk, setting up GPO's, simulating multiple users, and deployment of a domain server.",
      "This taught me hands on more about active directory.",
      "--",
    ],
    video: {
      src: `/testfoootage1.mp4`,
      poster: makePoster("windows-dc-lab.mp4"),
      duration: "10:53",
    },
  },
  {
    slug: "kubestui",
    name: "KubesTUI",
    desc: "a terminal UI to run my whole kubernetes homelab from one place.",
    body: [
      "After building my Kubernetes install script, I realized running everything through a plain text menu and remembering a bunch of commands wasn't the smooth experience I wanted. I wanted something a beginner could pick up, or honestly just me at 2am not wanting to type out every kubectl command. So I built KubesTUI, a terminal UI written in Go that sits on top of my homelabCD setup.",
      "What it does: it's basically the control center for my cluster. Bootstrap the first control plane, add control planes and worker nodes (on the node itself or remotely over SSH), clean up stuck pods, decommission a node, turn services on/off, and sync Argo CD apps. It also has a Command Center, a btop style live view of the cluster, a SOC console with network and DNS (Pi-hole) pages, a two pane file manager for my Longhorn volumes, file transfers to nodes, and an SSH console.",
      "The setup: on a fresh Ubuntu Server 24.04 machine you clone homelabCD and run sudo ./install.sh. It checks the host, installs what it needs (yq and Go), builds KubesTUI, launches it, and leaves a kbtui command so you can open it again whenever. From there you pick Bootstrap New Cluster, answer a few questions like your VIP, MetalLB IP range, GitOps repo, and domain, and it sets up Kubernetes, Cilium, kube-vip, MetalLB, Longhorn, cert-manager, and Argo CD for you.",
      "Don't want to SSH into a node every time? There's a one line install for Linux/macOS (and a PowerShell one for Windows) that grabs the latest release, and the bootstrap node can even share KubesTUI with any workstation on your LAN.",
      "It starts in dry run mode by default, so you can click around and see exactly what commands would run before it touches anything. The UI is built with tview and tcell, and Go's ssh library handles all the remote stuff.",
      "This one has been my favorite so far. 50+ commits in a few weeks of late nights, a whole lot of breaking SSH and fixing it again hahaha... It's still early development, but it turned my janky homelab into something I can actually manage, and that's exactly the kind of work I want to be doing as a DevOps/network engineer.",
    ],
    image: {
      src: `/command_center_kubestui.png`,
      caption: "command center, a live btop style view of the whole cluster",
    },
    video: {
      src: `/testfoootage2.mp4`,
      poster: makePoster("kubestui.mp4"),
      duration: "0:15",
    },
  },
  {
    slug: "portfolio",
    name: "How I Coded My Portfolio",
    desc: "How did I do this and why?",
    body: [
      "Why? I wanted to learn more about the process of building a website and how to code it. Im passionate about the things I do and this is a cool way to show it.",
      "I get my experience from working hands on with my own projects and learning from my mistakes. I am a quick learner and I'm always looking to improve my skills.",
      "With the ever changing landscape of technology, I am always looking for new ways to learn, and with the rise of AI it can help to learn faster and more efficiently.",
      "We must not rely on it completely, but it can be a great tool to learn. Thats what I did with this website. I used a AI agent to help me code the website and used the combination of inspect in webbrowser along with vscode; I was able to learn about the code that was being used.",
      "As I went through the proccess of wanting to improve my website. I learned and used AI along with offical documentation to understand what was being used and how it works.",
      "This was pretty simple to understand as I already have a background in HTML CSS and more. It just took a little creativity.",
      "You can see my whole thinking proccess through each commits. I loved learning this project, from the site building, to aquiring the website domain, and to deployment through vercel.",
      "Maybe not the most traditional way, but it worked! Through reading and a whole lot of trial and error. hahaha...",
    ],
    video: {
      src: `/testfoootage3.mp4`,
      poster: makePoster("portfolio.mp4"),
      duration: "14:48",
    },
  },
] as const;

const Index = () => {
  const [booted, setBooted] = useState(false);
  const [windows, setWindows] = useState<OpenWindow[]>([{ id: "main", z: 1 }]);
  const [topZ, setTopZ] = useState(1);
  const [activeVideo, setActiveVideo] = useState<VideoMeta | null>(null);
  
  // Hardcoded blog posts — only the site owner edits these in code.
  // EXAMPLE:
  //
  // {
  //   id: "post-x",
  //   title: "title",
  //   content: [
  //     {
  //         type: "text",
  //        body: "0", 
  //     },
  //     {
  //       type: "text",
  //       body: "test1", 
  //    }, 
  //    {
  //     type: "text",
  //     body: "text2", 
  //  },
  //   ],      
  //     createdAt: "jul 11, 2026",
  // },
  
  const posts: BlogPost[] = [

    {
      id: "post-15",
      title: "my own tool, still gitops first",
      content: [
        {
          type: "text",
          body: "one of the newest additions to the command center is argo cd resync. if an app shows up as OutOfSync in the apps panel, i can select it and resync it right there, without leaving KubesTUI or opening the argo cd web UI.",
        },
        {
          type: "text",
          body: "and that's just one of a lot of things you can do from KubesTUI. adding and removing nodes, turning services on and off, cleaning up stuck pods, moving files to my longhorn volumes, updating the cluster, it's all in one place. but there was one rule i didn't want to break while building all of it: git is still the source of truth.",
        },
        {
          type: "text",
          body: "KubesTUI doesn't go around gitops, it works with it. the resync button doesn't change what's supposed to be running, it just tells argo cd to match the cluster to what's already in my repo. if i want to actually change something, it still goes through a commit and push. that way i get the easy buttons of my own tool, and i still keep the history, rollbacks, and reviewable changes you get with gitops.",
        },
        {
          type: "image",
          url: "/Update-Gitops-Template example.png",
          alt: "updating the gitops templates from KubesTUI",
          full: true,
          caption: "updating my gitops templates from KubesTUI. the design has changed a bit since this screenshot, but it still works essentially the same.",
        },
        {
          type: "text",
          body: "even updates follow that rule. when i update my homelabCD templates, KubesTUI pulls my gitops repo, renders the templates with my saved settings, and only changes something if there's actually something new. everything still lands in the repo, and argo cd takes it from there.",
        },
        {
          type: "text",
          body: "that mattered a lot to me because gitops is the direction i want to grow in. i'm really interested in gitops and devops positions, and i didn't want to build something that only works my way. i wanted something that follows the same practices a real team would use.",
        },
        {
          type: "text",
          body: "building this whole thing solo taught me a ton, but honestly the thing i'm most excited about is getting to do this kind of work with a team. i'm a team player, i love learning from people who know more than me, and i like taking initiative, like seeing a problem in my own homelab and building a tool to fix it. hopefully that's what i get to do next hahaha...",
        },
      ],
      createdAt: "october 28, 2026",
    },

    {
      id: "post-14",
      title: "sharing KubesTUI + one device, many clusters",
      content: [
        {
          type: "text",
          body: "one of my favorite features in KubesTUI is share kubestui with a workstation. i got tired of ssh'ing into a node every time i wanted to check on the cluster, so now any computer on my LAN can grab KubesTUI straight from the cluster itself.",
        },
        { type: "image", url: "/Share Kubetui with powershell.png", alt: "sharing KubesTUI from a node to a windows workstation", full: true },
        {
          type: "text",
          body: "here's how it works. on a node you open the share screen and it starts a little download server on the LAN, behind a one-time link that shuts itself off after a timer. it shows you a one line command for windows (powershell) and one for macOS/linux, and you can copy either with a single key.",
        },
        {
          type: "text",
          body: "you paste that command on the computer you want to control the cluster from, and it downloads the right KubesTUI build for that machine, checks its SHA-256 checksum, installs it for your user, and even adds it to your PATH. the downloads panel on the node shows every file as it gets sent, which is super satisfying to watch hahaha...",
        },
        {
          type: "text",
          body: "security was a big thing for me here. only the program gets shared through that link, never any cluster credentials. those get set up afterwards over SSH when you pick connect a new cluster and enter a control plane's IP and your SSH login. and if you're away from home, you can just install it from github instead.",
        },
        {
          type: "text",
          body: "the best part is that connect a new cluster isn't a one time thing. one workstation can connect to as many clusters as you want, so my main pc can manage my homelab cluster and a test cluster in a VM from the same place, without having to jump between machines.",
        },
        {
          type: "text",
          body: "that's actually how i tested this, the node in the screenshot is a VM in virtualbox and my windows pc installed KubesTUI from it in seconds. having one device that can control multiple clusters makes it feel way less like a homelab script and more like a real tool.",
        },
      ],
      createdAt: "october 28, 2026",
    },

    {
      id: "post-13",
      title: "i actually love network troubleshooting",
      content: [
        {
          type: "text",
          body: "weird thing to say, but i've realized i genuinely love hunting down network issues. there's something about a pod that can't reach another pod, or a service that just won't get an IP, that makes me want to stay up way too late until it's fixed.",
        },
        {
          type: "text",
          body: "and kubernetes gives you a LOT of places for networking to break. pod networking through cilium, the virtual IP for the API server with kube-vip, metallb handing out loadbalancer IPs on my LAN, ingress-nginx and cert-manager getting every web UI its HTTPS address, and then dns on top of all of it. every layer is its own little puzzle.",
        },
        {
          type: "text",
          body: "my favorite part is the process. figure out which layer it is, is it the pod, the node, the service, the loadbalancer, or dns? then narrow it down one step at a time until it finally clicks. every time i fix one i understand how the whole thing fits together a little better, and that's exactly the kind of work i want to be doing as a network engineer.",
        },
        {
          type: "text",
          body: "the other thing that made all of this way more fun is the update system i added to homelabCD and KubesTUI. updating the cluster used to mean a bunch of manual steps on every node. now it's super easy, i just run the update and it takes care of it.",
        },
        {
          type: "text",
          body: "that was huge while developing KubesTUI. i'd find a bug while debugging the cluster, fix it, push it, and have the fix running in minutes instead of rebuilding everything by hand. that quick loop of break it, find it, fix it, update it is honestly what kept me going on those late nights hahaha...",
        },
      ],
      createdAt: "october 28, 2026",
    },

    {
      id: "post-12",
      title: "a closer look at the command center",
      content: [
        {
          type: "text",
          body: "i mentioned the command center in my last post, but it deserves its own post because it's my favorite screen in KubesTUI. it's the btop/k9s style live view of my whole cluster, all on one screen, refreshing every 2 seconds.",
        },
        { type: "image", url: "/command_center_kubestui.png", alt: "KubesTUI command center", full: true },
        {
          type: "text",
          body: "it's split into 8 panels. at the top is the cluster panel, which shows the API server, how many nodes and pods are ready, argo cd health, the metallb pool, and storage, plus live CPU, memory, and network graphs for the whole cluster.",
        },
        {
          type: "text",
          body: "under that is the nodes panel. every node gets its own CPU, memory, disk, and network bars with little history graphs, so i can see right away which machine is working the hardest. (yes, my nodes are named gojo, megumi, nanami, toji, and yuta hahaha...)",
        },
        {
          type: "text",
          body: "then there's pods, sorted by CPU, with restart counts in red so the troublemakers stand out. namespaces shows usage per namespace, and apps shows every argo cd app with its sync and health status, so i know right away if something drifted from my gitops repo.",
        },
        {
          type: "text",
          body: "on the right side, network shows the metallb IPs and the HTTPS links for every web UI, storage shows disk usage per node and my longhorn volumes, and alerts collects warnings from kubernetes events and argo cd in one place.",
        },
        {
          type: "text",
          body: "it's all keyboard driven like btop. 1-8 jumps to a panel, tab moves to the next one, enter opens details, / searches, s sorts, z zooms a panel to full screen, +/- changes the refresh speed, and p pauses it. no more running five different kubectl commands just to see if everything is okay.",
        },
      ],
      createdAt: "october 27, 2026",
    },

    {
      id: "post-11",
      title: "finally, quality of life for the installer",
      content: [
        {
          type: "text",
          body: "it's finally here. the quality of life update i've been talking about since the first version of my kubernetes install script. no more plain text menus and memorizing a bunch of commands, the installer now comes with its own terminal UI written in go.",
        },
        {
          type: "text",
          body: "i call it KubesTUI. the inspiration was tools like k9s and btop, those terminal apps that just feel good to use. everything live, everything on one screen, and you move around with your keyboard instead of typing out kubectl commands at 2am hahaha...",
        },
        {
          type: "text",
          body: "now on a fresh ubuntu server you run sudo ./install.sh and it checks the host, grabs what it needs (yq and go), builds KubesTUI and launches it. it also leaves a kbtui command so you can jump back in whenever. from there you pick bootstrap new cluster, answer a few questions, and it sets everything up for you.",
        },
        {
          type: "text",
          body: "inside it you can add control planes and worker nodes (even remotely over ssh), clean up stuck pods, decommission nodes, turn services on/off, and sync argo cd apps. my favorite part is the command center, a btop style live view of the whole cluster. there's also a file manager for my longhorn volumes and an ssh console built right in.",
        },
        {
          type: "text",
          body: "it starts in dry run mode by default, so you can click around and see exactly what it would run before it actually touches anything. that was a big one for me, since the whole point is making this friendly for a beginner, or just me not wanting to break my cluster again.",
        },
        {
          type: "text",
          body: "learning go for this was a ride. tview and tcell for the UI, go's ssh library for all the remote stuff, and a lot of breaking ssh and fixing it again. still early development, but it finally feels like a real tool instead of a janky script. check out KubesTUI in my projects for more!",
        },
      ],
      createdAt: "october 27, 2026",
    },

    {
      id: "post-10",
      title: "birthday gift :}",
      content: [
        {
          type: "text",
          body: "my very sweet partner gifted me a thinkcentre mini workstation, great specs and perfect for my bare metal kubernetes setup.",
        },
      ],
      createdAt: "august 24, 2026",
    },

    {
      id: "post-9",
      title: "kubernetes script update",
      content: [
        {
          type: "text",
          body: "i cant believe what has happened these past few days...",
        },
        {
          type: "text",
          body: "i've been pulling late nights building my first general scripting project. my thought process has been easy kubernetes deployment replication and customization.",
        },
        {
          type: "text",
          body: "it's been a lot of figuring out what i want from the script and it's objective. i wanted it to first install necessary dependencies that need to be installed, so that the system has everything to be easily intergrated into a new/existing hardware deployment. this is something that would be perfect for an overkill homelab, which is exactly what i want.",
        },
        { type: "image", url: "/Kubes1.webp" },
        { type: "image", url: "/Kubes2.webp" },
        {
          type: "text",
          body: "overall most of my road blocks came from coding issues and just seeing what works with what, well enough to keep going till i atleast had a good foundation. that i can hopefully work on and make more pretty/enchance the user experience.",
        },
        {
          type: "text",
          body: "so far i've got it at a good point where i can; first, setup a brand new ubuntu server from scratch with all prerequisites needed, second, ask what you want to do like a health check, instalizing control plane/worker nodes, display worker/control plane keys, etc.",
        },
      ],
      createdAt: "august 10, 2026",
    },
  
    {
      id: "post-8",
      title: "kubernetes scripting project",
      content: [
        {
          type: "text",
          body: "i wanted to create a script that would automate the installation of kubernetes, but not just that, i also wanted to initialize new control planes and worker nodes easily. on top of that i also wanted easy control and configuration through gitops.", 
        },
        {
          type: "text",
          body: "the goal is infrastructure as code, as this would be easily replicated, edited, updated, rollbacked, and many more fun things you get when you go with an overkill option like; kubernetes to run a small, 2 person use only home server. this has been super fun figuring out on both, the software and networking side. a deployment like this is something i would love to work on, in a professional networking workplace.", 
       }, 
       {
          type: "text",
          body: "i have a lot of work ahead of me, but i think this is something i would like to constantly work on and improve. like user interface and overall smooth experience for a beginnner ideally, or someone who just want to setup their own easy complex kubernetes setup hahaha... we will see how it goes.", 
     },
     ],      
     createdAt: "july 31, 2026",
    },
    {
      id: "post-7",
      title: "headless laptop update",
      content: [
        {
          type: "text",
          body: "i have a working headless laptop server. this my 3rd server for my future kubernetes homelab cluster. I was able to search up a pattern for my specific laptop bios settings, to get to secure boot and disabling it.", 
        },
        {
          type: "text",
          body: "once i did that i was able to press f10+Enter to save bios settings then it detects my ssd with a live boot on it (made with rufus). since it boots into ubuntu live install it i finally get a disply through hdmi. then i'm able to setup ubuntu and after a completed install, i run as completely headless. i only ssh into it from there. ", 
         }, 
         {
          type: "text",
          body: "this was a lot of tinkering and seeing what works and what doesn't. i'm glad i didn't give up and that i was able to learn from every detail, to come out with a new working server.", 
       },
      ],      
      createdAt: "jul 15, 2026",
    },
    {
      id: "post-6",
      title: "future home lab setup",
      content: [
        {
          type: "text",
          body: "so this new obsesstion of mine is network related, i've been really digging the 10inch rack builds. r/minilab is a really cool space. i'll make a post there once i make this project im going to talk about happen.", 
        },
        { type:"image", url: "/rack inspo.webp" },
        {
          type: "text",
          body: "i saw a user post a ikea kallax rack lab that is 3d printed out and makes a clean easy 7u rack system. i saw this at the same time i picked up a 4x4 kallax cabinet for my new apartment.", 
         }, 
         {
          type: "text",
          body: "so ideally i'll use two cubes for my custom rack meaning i have 14u of space to work with. in the future i would ideally have a 2x4 kallax, full custom refinshed with the help of my carpentry background. i got a render that gives a picture for how i want it. ", 
       },
       { type:"image", url: "/rack render.webp" },
       {
        type: "text",
        body: "i went with this style because i wanted the whole cabinet to be dedicated to my servers/home-network. it's a cool style to me, pretty minimal footprint, super easy to expand. having a dedicated box for networking, servers, nas, ai computer cluster.",
       },
      ],      
      createdAt: "jul 12, 2026",
      },
    {
      id: "post-5",
      title: "oh my !!",
      content: [
        {
           type: "text",
           body: "its been a couple days and let me tell you its been a handful. this has been my attempt just trying to see whatever works. fair warning i do have a new plan of attack that i will try after this. but so far this is what i have been up to.", 
        },
        {
          type: "text",
          body: "my first idea was to load a linux os to a ssd. this computer has no drive so my hypothesis was since the ssd is the only drive connected (usb 3.0 10g), it will only read that device and boot straight into linux and work perfectly. obviously that never actually happens in real life.", 
        }, 
        {
        type: "text",
        body: "i first tried to download a linux instantce on a usb ssd with my imac ubuntu server. it kept breaking my sudo when i was chroot into the ssd linux instance. Beacause i was in the chroot i thought it was working, but it wasnt after testing by loading the os on my main pc.", 
        },
        {
          type: "text",
          body: "that within itself troubleshooting took up hours of my life. i then choose to get a live usb for ubuntu server, run it on my main pc then load the installation to my external ssd. i got visual confirmation with the keyboard lights that i boot into the computer's bios after i press f10 to save and quit it restarts the pc.",
        },
        {
          type: "text",
          body: "so the only issue is trying to load into an os blindly, because our internal screen is broken and computer wont output to hdmi so we cant work at bios level. if we can load into os we can see on external screen for sure.",
        },
        {
          type: "text",
          body: "so next course of action is to blind live usb install ubuntu server witih patience and lots of luck. then if it loads at least i can ssh through my other computer to get drivers so the hdmi works. the reason it didnt work is because the drivers that were downloaded through my computer doesn't allow me to boot straight through it without messing with secure boot. a live usb will make it boot into the drive instantly. i just have to be slick with downloading ubuntu accordingly.",
        },
      ],      
        createdAt: "jul 11, 2026",
    },
    {
      id: "post-4",
      title: "new project!",
      content: [
        {
           type: "text",
           body: "a new friend of mine gave me a laptop with no screen, passed on the project to me haha. i'm starting to diagnose this but there are some issues that can clue me on what we can try", 
        },
        {
          type: "text",
          body: "doesnt go to external monitor because bios is locked to work only on internal monitor. im going to see if i can bypass this by booting into linux and seeing if the drivers can get the external monitor signal to show the pc is working.", 
       }, 
       {
        type: "text",
        body: "if i can get this working i will make this my third server and might start working more on kubernetes since i have the hardware to do so. lets hope this is an easy fix!", 
     },
      ],      
        createdAt: "jul 8, 2026",
    },
    {
      id: "post-3",
      title: "new homelab setup",
      content: [
        {
          type: "text",
          body: "i got my network all connected, now mind you my setup is a lil janky but it works. it protects my network, pi-hole for ads, wireguard for vpn, navidrome for music, portainter for docker management, and more.",
        },
        { type: "image", url: "/pc server.webp" },
        {
          type: "text",
          body: "this is my router below, i dont have a dedicated switch but i have a parts list for a specific build i'd love to do in the future. right now i only have 2 servers. i would like to have another 2 servers down the road but for now these two servers are more then enough for me.",
        },
        { type:"image", url: "/router.webp" },
        {
          type: "text",
          body: "i had to spoof my providers mac address onto my router to be able to have my internet connection established, after doing that my server updated my new ip address to my duckdns. then my network worked accordingly :D",
        },
      ],
      createdAt: "jul 1, 2026",
    },
    {
      id: "post-2",
      title: "shipped the portfolio rewrite",
      content: [
        {
          type: "text",
          body: "redid the whole site as a desktop OS. windows, taskbar, draggable everything. it's silly and i love it. blog window included so i can drop updates without leaving the vibe.",
        },
      ],
      createdAt: "apr 24, 2026",
    },
    {
      id: "post-1",
      title: "cisco packet tracer deep dive",
      content: [
        {
          type: "text",
          body: "spent the weekend building out a multi-vlan campus topology in packet tracer. inter-vlan routing on a layer 3 switch, dhcp relay, and acls between segments. wrote up the lab in the projects window.",
        },
        { type: "video", url: "/testfoootage.mp4" },
      ],
      createdAt: "apr 10, 2026",
    },
  ];


  const openApp = (id: AppId) => {
    setTopZ((z) => z + 1);
    setWindows((ws) => {
      if (ws.find((w) => w.id === id)) {
        return ws.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w));
      }
      return [...ws, { id, z: topZ + 1 }];
    });
  };

  const focusApp = (id: AppId) => {
    setTopZ((z) => z + 1);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)));
  };

  const closeApp = (id: AppId) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  };

  const getZ = (id: AppId) => windows.find((w) => w.id === id)?.z ?? 0;
  const isOpen = (id: AppId) => windows.some((w) => w.id === id);

  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard", { description: label ?? text });
    } catch {
      toast.error("Couldn't copy", { description: "Try selecting the text manually." });
    }
  };

  if (!booted) return <BootScreen onDone={() => setBooted(true)} />;

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="min-h-screen desktop-bg relative overflow-hidden">
      {/* Top menu bar */}
      <header className="absolute top-0 inset-x-0 h-7 bg-[hsl(var(--window-chrome))] text-[hsl(var(--window-chrome-foreground))] flex items-center justify-between px-3 text-xs z-50 shadow-md">
        <div className="flex items-center gap-4">
          <span className="font-bold">⬢ jose-os</span>
          <span className="opacity-80 hidden sm:inline">File</span>
          <span className="opacity-80 hidden sm:inline">Edit</span>
          <span className="opacity-80 hidden sm:inline">View</span>
          <span className="opacity-80 hidden sm:inline">Help</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-80 hidden sm:inline">welcome@portfolio</span>
          <span>{now}</span>
        </div>
      </header>

      {/* Desktop icons */}
      <div className="absolute top-9 left-2 flex flex-col gap-3 p-2 z-0">
        {([
          { id: "about", label: "About Me", icon: User },
          { id: "projects", label: "Projects", icon: FolderGit2 },
          { id: "contact", label: "Contact", icon: MessageCircle },
          { id: "links", label: "Links", icon: LinkIcon },
          { id: "faqs", label: "FAQs", icon: HelpCircle },
          { id: "blog", label: "Blog", icon: Newspaper },
          { id: "game", label: "Game", icon: Gamepad2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onDoubleClick={() => openApp(id)}
            onClick={() => openApp(id)}
            className="flex flex-col items-center gap-1 w-20 group"
          >
            <div className="h-12 w-12 rounded-md bg-[hsl(var(--window-bg))] border border-[hsl(var(--window-chrome))] flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors window-shadow">
              <Icon className="h-6 w-6" />
            </div>
            <span className="text-xs text-[hsl(var(--window-chrome-foreground))] bg-[hsl(var(--window-chrome)/0.7)] px-1.5 py-0.5 rounded">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Windows */}
      {isOpen("main") && (
        <Window
          title="readme.txt"
          initialX={typeof window !== "undefined" ? Math.max(140, window.innerWidth / 2 - 240) : 200}
          initialY={80}
          width={480}
          zIndex={getZ("main")}
          onFocus={() => focusApp("main")}
          onClose={() => closeApp("main")}
        >
          <h1 className="text-2xl font-bold mb-2">hi, i'm Jose 👋</h1>
          <p className="text-muted-foreground mb-4">
            welcome to my little corner of the internet. poke around — open the
            folders on the desktop or pick something below.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "projects", label: "📁 Projects" },
              { id: "contact", label: "✉ Contact" },
              { id: "links", label: "🔗 Links" },
              { id: "faqs", label: "? FAQs" },
            ] as const).map((b) => (
              <button
                key={b.id}
                onClick={() => openApp(b.id)}
                className="px-3 py-2 text-left bg-secondary hover:bg-primary hover:text-primary-foreground border border-border rounded-sm transition-colors text-sm"
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
            tip: drag windows by the title bar. they stack like a real desktop. click start button bottom left to open readme.txt again.
          </div>
        </Window>
      )}

      {isOpen("contact") && (
        <Window
          title="contact.app"
          initialX={260}
          initialY={160}
          width={380}
          zIndex={getZ("contact")}
          onFocus={() => focusApp("contact")}
          onClose={() => closeApp("contact")}
        >
          <h2 className="text-lg font-bold mb-3">get in touch</h2>
          <ul className="space-y-2">
            {([
              { icon: Mail, text: "josejcorral77.jc@gmail.com" },
              { icon: Twitter, text: "@-" },
              { icon: Linkedin, text: "linkedin.com/in/josecorr" },
            ] as const).map(({ icon: Icon, text }) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => copyToClipboard(text)}
                  className="flex items-center gap-2 w-full text-left hover:underline cursor-pointer"
                  title="Click to copy"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  {text}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">click any item to copy. i usually reply within a day or two.</p>
        </Window>
      )}

      {isOpen("projects") && (
        <Window
          title="projects/"
          initialX={340}
          initialY={120}
          width={460}
          zIndex={getZ("projects")}
          onFocus={() => focusApp("projects")}
          onClose={() => closeApp("projects")}
        >
          <h2 className="text-lg font-bold mb-3">selected work</h2>
          <ul className="space-y-3">
            {PROJECTS.map((p) => (
              <li
                key={p.slug}
                onClick={() => openApp(`project:${p.slug}` as AppId)}
                className="border border-border rounded-sm p-2 hover:bg-secondary transition-colors cursor-pointer"
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </li>
            ))}
          </ul>
        </Window>
      )}

      {PROJECTS.map((p, i) => {
        const id = `project:${p.slug}` as AppId;
        if (!isOpen(id)) return null;
        return (
          <Window
            key={p.slug}
            title={`${p.name.toLowerCase()}.md`}
            initialX={200 + i * 30}
            initialY={140 + i * 20}
            width={520}
            height={420}
            zIndex={getZ(id)}
            onFocus={() => focusApp(id)}
            onClose={() => closeApp(id)}
          >
            <div className="pr-2">
            <h2 className="text-xl font-bold mb-1">{p.name}</h2>
            <p className="text-xs text-muted-foreground mb-4">{p.desc}</p>
            <div className="space-y-3">
              {p.body.map((para, idx) => (
                <p key={idx} className="text-sm">{para}</p>
              ))}
            </div>
            {"image" in p && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">screenshot</div>
                <a href={p.image.src} target="_blank" rel="noreferrer">
                  <img
                    src={p.image.src}
                    alt={p.image.caption}
                    loading="lazy"
                    className="w-full h-auto rounded-sm border border-border"
                  />
                </a>
                <p className="text-[11px] text-muted-foreground mt-1">{p.image.caption}</p>
              </div>
            )}
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">demo video</div>
              <button
                onClick={() => {
                  setActiveVideo({
                    title: `${p.name} — demo`,
                    src: p.video.src,
                    poster: p.video.poster,
                    channel: "jose",
                    views: `${(i + 1) * 1234} views`,
                    uploaded: "2 weeks ago",
                    description: p.body[0],
                  });
                  openApp("josetube");
                }}
                className="group relative block w-full overflow-hidden rounded-sm border border-border bg-black"
              >
                <img
                  src={p.video.poster}
                  alt={`${p.name} demo thumbnail`}
                  loading="lazy"
                  className="w-full h-40 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <div className="ml-1 w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-primary-foreground" />
                  </div>
                </div>
                <div className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">{p.video.duration}</div>
              </button>
            </div>
            </div>
          </Window>
        );
      })}

      {isOpen("josetube") && activeVideo && (
        <Window
          title="josetube.com"
          initialX={120}
          initialY={70}
          width={760}
          height={620}
          zIndex={getZ("josetube")}
          onFocus={() => focusApp("josetube")}
          onClose={() => closeApp("josetube")}
        >
          <div className="-m-5">
            <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2 font-bold">
                <span className="h-6 w-6 rounded-sm bg-primary-foreground text-primary flex items-center justify-center text-xs">▶</span>
                <span className="tracking-tight">JoseTube</span>
              </div>
              <input
                placeholder="search josetube..."
                className="hidden sm:block flex-1 mx-4 max-w-xs px-2 py-1 text-xs rounded-sm bg-primary-foreground/20 placeholder:text-primary-foreground/70 outline-none"
              />
              <div className="text-xs opacity-80">🌿 sign in</div>
            </div>
            <div className="bg-black">
              <video
                key={activeVideo.src}
                src={activeVideo.src}
                poster={activeVideo.poster}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[55vh] bg-black"
              />
            </div>
            <div className="p-4 bg-card">
              <h3 className="text-base font-bold mb-1">{activeVideo.title}</h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>{activeVideo.views} • {activeVideo.uploaded}</span>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-primary text-primary-foreground rounded-sm">👍 like</span>
                  <span className="px-2 py-1 bg-secondary rounded-sm">↗ share</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">J</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{activeVideo.channel}</div>
                  <div className="text-xs text-muted-foreground">12.3k subscribers</div>
                </div>
                <button className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-sm">subscribe</button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{activeVideo.description}</p>
            </div>
          </div>
        </Window>
      )}

      {isOpen("about") && (
        <Window
          title="about-me.txt"
          initialX={200}
          initialY={100}
          width={460}
          zIndex={getZ("about")}
          onFocus={() => focusApp("about")}
          onClose={() => closeApp("about")}
        >
          <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-border">
            <div>
              <h2 className="text-xl font-bold">About Me</h2>
              <p className="text-xs text-muted-foreground">a quick intro</p>
            </div>
            <img
              src="/favicon.ico"
              alt="Jose's favicon"
              className="h-10 w-10 rounded-sm border border-border shrink-0"
            />
          </div>
          <div className="pr-2 space-y-3 text-sm">
            <p>
              hi, i'm Jose — a tech enthusiast based in Santa Cruz (originally from Seattle).
              i love building tools, breaking labs, and figuring out how things work under the hood.
            </p>
            <p>
              my interests sit at the crossroads of networking, sysadmin work, and full-stack
              development. lately i've been deep in homelab projects, CLI tooling, and mainly learning
              everything i can about enterprise infrastructure.
            </p>
            <p>
              when i'm not in front of a terminal, you'll find me chasing waves, gaming,
              or just hanging out with my partner.
            </p>
            <p>
              i'm a big family guy, i've been an uncle all my life and i have a lot of experience
              with mentoring and teaching ranging from infants, toddlers, and school-aged children.
            </p>
            <p>
              if you want to know more about me and my work, check out my{" "}
              <button
                type="button"
                onClick={() => openApp("blog")}
                className="inline p-0 border-0 bg-transparent font-inherit text-primary hover:underline cursor-pointer"
              >
                blog
              </button>{" "}
              or{" "}
              <button
                type="button"
                onClick={() => openApp("projects")}
                className="inline p-0 border-0 bg-transparent font-inherit text-primary hover:underline cursor-pointer"
              >
                projects
              </button>
              .
            </p>
          </div>
        </Window>
      )}


      {isOpen("links") && (
        <Window
          title="links.html"
          initialX={420}
          initialY={220}
          width={360}
          zIndex={getZ("links")}
          onFocus={() => focusApp("links")}
          onClose={() => closeApp("links")}
        >
          <h2 className="text-lg font-bold mb-3">around the web</h2>
          <ul className="space-y-2">
            <li>
              <button
                type="button"
                onClick={() => copyToClipboard("github.com/usbee100k")}
                className="flex items-center gap-2 w-full text-left hover:underline cursor-pointer"
                title="Click to copy"
              >
                <Github className="h-4 w-4 text-primary shrink-0" /> github.com/usbee100k
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => copyToClipboard("linkedin.com/in/josecorr")}
                className="flex items-center gap-2 w-full text-left hover:underline cursor-pointer"
                title="Click to copy"
              >
                <Linkedin className="h-4 w-4 text-primary shrink-0" /> linkedin.com/in/josecorr
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => openApp("blog")}
                className="flex items-center gap-2 w-full p-0 border-0 bg-transparent font-inherit text-left hover:underline cursor-pointer"
              >
                <LinkIcon className="h-4 w-4 text-primary" /> my blog (click me!)
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => openApp("about")}
                className="flex items-center gap-2 w-full p-0 border-0 bg-transparent font-inherit text-left hover:underline cursor-pointer"
              >
                <LinkIcon className="h-4 w-4 text-primary" /> read.me/jose (click me!)
              </button>
            </li>
          </ul>
        </Window>
      )}

      {isOpen("faqs") && (
        <Window
          title="faqs.md"
          initialX={500}
          initialY={180}
          width={440}
          zIndex={getZ("faqs")}
          onFocus={() => focusApp("faqs")}
          onClose={() => closeApp("faqs")}
        >
          <h2 className="text-lg font-bold mb-3">frequently asked</h2>
          <div className="space-y-3">
            {[
              { q: "where are you based?", a: "Seattle Wa originally but i recently relocated to Santa Cruz." },
              { q: "are you available for work?", a: "hungry for work in tech available for work now — ping me." },
              { q: "what stack do you use?", a: "typescript, react, go, postgres, and lots of coffee." },
              { q: "why the desktop theme?", a: "to show my love for computers and i think it's fun to play with haha." },
            ].map((f) => (
              <div key={f.q}>
                <div className="font-semibold">› {f.q}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{f.a}</div>
              </div>
            ))}
          </div>
          {!isOpen("more-faqs") && (
            <div className="mt-4 pt-3 border-t border-border">
              <button
                onClick={() => openApp("more-faqs")}
                className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-opacity"
              >
                more questions? →
              </button>
            </div>
          )}
        </Window>
      )}

      {isOpen("more-faqs") && (
        <Window
          title="more-faqs.md"
          initialX={180}
          initialY={120}
          width={460}
          height={420}
          zIndex={getZ("more-faqs")}
          onFocus={() => focusApp("more-faqs")}
          onClose={() => closeApp("more-faqs")}
        >
          <h2 className="text-lg font-bold mb-3">more questions</h2>
          <div className="pr-2 space-y-3">
            {[
              { q: "what got you into tech?", a: "tinkering with any electronics as a kid, building my own computers, and then eventually getting into programming and networking." },
              { q: "favorite project so far?", a: "creating my homelab, it taught me the most about networking and troubleshooting. it's kind of janky but it works and she'll get an upgrade soon." },
              { q: "mac, windows, or linux?", a: "linux for servers, mac and windows for daily driving." },
              { q: "favorite editor?", a: "cursor for coding, nano for text editing." },
              { q: "coffee or tea?", a: "coffee. always coffee." },
              { q: "do you game?", a: "occasionally — mostly multiplayer open worlds and shooters with friends." },
              { q: "what are you learning right now?", a: "deeper networking — subnetting, vlans, and routing protocols." },
              { q: "any certifications?", a: "working toward CompTIA Network+ and eventually CCNA." },
              { q: "open to remote work?", a: "yes! remote or hybrid. bay area in person also works." },
              { q: "favorite spot in santa cruz?", a: "anywhere along west cliff at sunset." },
              { q: "do you blog?", a: "writing more lately — mostly homelab notes and project breakdowns." },
              { q: "how can i contact you?", a: "check the contact window — email is fastest." },
            ].map((f) => (
              <div key={f.q}>
                <div className="font-semibold">› {f.q}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{f.a}</div>
              </div>
            ))}
          </div>
        </Window>
      )}

      {isOpen("blog") && (
        <Window
          title="blog.app"
          initialX={typeof window !== "undefined" ? Math.max(40, window.innerWidth / 2 - 360) : 80}
          initialY={60}
          width={720}
          height={690} //niceeee.... 
          zIndex={getZ("blog")}
          onFocus={() => focusApp("blog")}
          onClose={() => closeApp("blog")}
        >
          <div className="-m-5">
            {/* Blog header */}
            <div className="px-5 py-4 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">jose's blog</h2>
                  <p className="text-xs opacity-80">notes, builds, and the occasional rant.</p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-primary-foreground text-primary rounded-sm hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  new post
                </button>
              </div>
            </div>

            {/* Sticky mascot + posts */}
            <div className="flex items-start gap-3 p-4 bg-card">
              <aside className="shrink-0 w-40 sticky top-2 self-start hidden sm:block">
                <div className="border border-border rounded-sm bg-background p-2">
                  <img
                    src={blogMascot}
                    alt="blog mascot"
                    className="w-full h-auto animate-float select-none pointer-events-none"
                    draggable={false}
                  />
                  <div className="mt-1 text-center text-[10px] text-primary font-mono animate-flicker">funniest tech blog :P</div>
                </div>
              </aside>

              <div className="flex-1 min-w-0 space-y-4">
                {posts.map((post) => (
                  <article key={post.id} className="border border-border rounded-sm bg-background overflow-hidden">
                    <header className="px-3 pt-3">
                      <h3 className="text-base font-bold leading-tight">{post.title}</h3>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {post.createdAt}
                      </div>
                    </header>
                    {post.content.map((block, idx) => {
                      if (block.type === "text") {
                        return (
                          <p key={idx} className="px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                            {block.body}
                          </p>
                        );
                      }
                      if (block.type === "image") {
                        return (
                          <figure key={idx}>
                            <img
                              src={block.url}
                              alt={block.alt ?? post.title}
                              className={block.full ? "w-full h-auto" : "w-full max-h-80 object-cover"}
                            />
                            {block.caption && (
                              <figcaption className="px-3 pt-1 text-[11px] text-muted-foreground italic">{block.caption}</figcaption>
                            )}
                          </figure>
                        );
                      }
                      return (
                        <video key={idx} src={block.url} controls className="w-full max-h-80 bg-black" />
                      );
                    })}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Window>
      )}

      {isOpen("game") && (
        <Window
          title="fight.gif"
          initialX={260}
          initialY={160}
          width={650}
          stableScroll
          zIndex={getZ("game")}
          onFocus={() => focusApp("game")}
          onClose={() => closeApp("game")}
        >
          <AsciiFight />
          <p className="mt-2 text-[11px] text-muted-foreground">jose vs the bug that broke ssh. every. single. time.</p>
        </Window>
      )}

      {/* Taskbar */}
      <footer className="absolute bottom-0 inset-x-0 h-9 bg-[hsl(var(--window-chrome))] text-[hsl(var(--window-chrome-foreground))] flex items-center gap-1 px-2 z-50 border-t border-[hsl(30_25%_25%)]">
        <button
          onClick={() => openApp("main")}
          className="px-3 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-sm hover:opacity-90"
        >
          ⬢ Start
        </button>
        <div className="h-5 w-px bg-[hsl(30_25%_25%)] mx-1" />
        {windows.map((w) => (
          <button
            key={w.id}
            onClick={() => focusApp(w.id)}
            className="px-2 py-1 text-xs bg-[hsl(30_15%_25%)] hover:bg-[hsl(30_15%_30%)] rounded-sm"
          >
            {w.id}
          </button>
        ))}
      </footer>
    </main>
  );
};

export default Index;
