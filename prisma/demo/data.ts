/**
 * Static content for the demo seeder (prisma/seed-demo.ts).
 * Realistic Bangladesh-flavoured data; every email uses DEMO_DOMAIN so nothing is ever
 * sent to a real inbox and `--reset` can find (and remove) exactly what the seeder created.
 */

export const DEMO_DOMAIN = 'demo.petplex.dev';
export const DEMO_PASSWORD = 'Demo@1234';

/** Stock photos in the frontend's /public/images, by the animal they show (no rabbit/bird photos → none). */
export const PHOTOS: Record<'dog' | 'cat' | 'rabbit' | 'bird' | 'fish', readonly string[]> = {
  dog: [
    'service-grooming.jpg',
    'service-walking.jpg',
    'service-daycare.jpg',
    'gallery-puppy.jpg',
    'gallery-terrier.jpg',
    'gallery-beagle.jpg',
    'gallery-collie.jpg',
    'gallery-glasses.jpg',
    'hero-grooming.jpg',
    'pet-gallery-1.jpg',
    'pet-gallery-3.jpg',
  ],
  cat: ['gallery-paw.jpg', 'service-spa.jpg', 'pet-gallery-2.jpg', 'service-sitting.jpg'],
  rabbit: [],
  bird: [],
  fish: [],
};

export const FIRST_NAMES = [
  'Rahim',
  'Karim',
  'Nadia',
  'Sadia',
  'Tanvir',
  'Nusrat',
  'Fahim',
  'Ayesha',
  'Imran',
  'Farzana',
  'Rafi',
  'Mehjabin',
  'Arif',
  'Tasnim',
  'Shakil',
  'Sumaiya',
  'Zahid',
  'Lamia',
  'Rakib',
  'Tahmina',
  'Sabbir',
  'Nabila',
  'Mahin',
  'Raisa',
  'Sajid',
  'Anika',
  'Fardin',
  'Jannat',
  'Tamim',
  'Riya',
  'Asif',
  'Mim',
  'Hasib',
  'Proma',
  'Nayeem',
  'Orpa',
  'Shuvo',
  'Tania',
  'Ehsan',
  'Puja',
  'Rashed',
  'Sharmin',
  'Masud',
  'Lubna',
  'Ovi',
  'Disha',
] as const;

export const LAST_NAMES = [
  'Ahmed',
  'Hossain',
  'Islam',
  'Rahman',
  'Khan',
  'Chowdhury',
  'Uddin',
  'Akter',
  'Sarker',
  'Haque',
  'Karim',
  'Alam',
  'Siddiqui',
  'Talukder',
  'Bhuiyan',
  'Mahmud',
  'Kabir',
  'Roy',
  'Das',
  'Saha',
] as const;

export const AREAS = [
  'Gulshan 2',
  'Banani',
  'Dhanmondi 27',
  'Uttara Sector 7',
  'Bashundhara R/A',
  'Mirpur DOHS',
  'Mohammadpur',
  'Baridhara',
  'Lalmatia',
  'Mohakhali DOHS',
  'Niketan',
  'Wari',
] as const;

export const STAFF = [
  {
    firstName: 'Jessica',
    lastName: 'Rozario',
    bio: 'Senior groomer, 7 years. Loves doodles and nervous rescues.',
    skills: ['grooming', 'spa'],
  },
  {
    firstName: 'Nafis',
    lastName: 'Rahman',
    bio: 'Certified dog handler and walker. Ex-K9 volunteer.',
    skills: ['walking', 'training', 'daycare'],
  },
  {
    firstName: 'Sharmin',
    lastName: 'Akter',
    bio: 'Cat specialist — gentle grooming and fear-free handling.',
    skills: ['grooming', 'spa', 'sitting'],
  },
  {
    firstName: 'Tareq',
    lastName: 'Hasan',
    bio: 'Pet sitter and daycare lead. Pet first-aid trained.',
    skills: ['sitting', 'daycare', 'walking'],
  },
  {
    firstName: 'Mitu',
    lastName: 'Saha',
    bio: 'Spa therapist — aromatherapy, de-shedding and paw care.',
    skills: ['spa', 'grooming'],
  },
  {
    firstName: 'Rony',
    lastName: 'Das',
    bio: 'Positive-reinforcement trainer for puppies and adult dogs.',
    skills: ['training', 'walking'],
  },
] as const;

/** image = file name under DEMO_IMAGE_BASE_URL */
export const CATEGORIES = [
  {
    key: 'grooming',
    name: 'Grooming',
    description: 'Baths, haircuts, nails and ears by certified groomers.',
    icon: 'scissors',
    image: 'service-grooming.jpg',
  },
  {
    key: 'spa',
    name: 'Spa & Wellness',
    description: 'Massage, aromatherapy and coat treatments.',
    icon: 'sparkles',
    image: 'service-spa.jpg',
  },
  {
    key: 'walking',
    name: 'Walking & Exercise',
    description: 'Energetic walks and play for busy days.',
    icon: 'footprints',
    image: 'service-walking.jpg',
  },
  {
    key: 'sitting',
    name: 'Pet Sitting',
    description: 'Loving care at home while you are away.',
    icon: 'home',
    image: 'service-sitting.jpg',
  },
  {
    key: 'daycare',
    name: 'Daycare',
    description: 'Supervised play and naps with friends.',
    icon: 'sun',
    image: 'service-daycare.jpg',
  },
  {
    key: 'training',
    name: 'Training',
    description: 'Positive-reinforcement manners and puppy classes.',
    icon: 'graduation-cap',
    image: 'gallery-glasses.jpg',
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

export const SERVICES: {
  category: CategoryKey;
  name: string;
  short: string;
  description: string;
  price: number;
  discount?: number;
  minutes: number;
  pets: string[]; // pet type slugs
  featured?: boolean;
  vaccination?: boolean;
  image: string;
  popularity: number; // relative booking weight
}[] = [
  {
    category: 'grooming',
    name: 'Full Grooming',
    short: 'Bath, haircut, nail trim, ear cleaning and blow-dry.',
    description:
      'Our signature package.\n\nIncludes a warm bath with pet-safe shampoo, breed-appropriate haircut, nail trim, ear cleaning, teeth wipe and a fluffy blow-dry. Finished with a bandana and a treat.',
    price: 1800,
    discount: 1500,
    minutes: 90,
    pets: ['dog', 'cat'],
    featured: true,
    image: 'service-grooming.jpg',
    popularity: 10,
  },
  {
    category: 'grooming',
    name: 'Bath & Brush',
    short: 'A quick refresh between full grooms.',
    description: 'Bath, conditioner, brush-out and nail check. Perfect every 2–3 weeks.',
    price: 900,
    minutes: 45,
    pets: ['dog', 'cat', 'rabbit'],
    image: 'gallery-puppy.jpg',
    popularity: 8,
  },
  {
    category: 'grooming',
    name: 'Puppy First Groom',
    short: 'A gentle, fear-free first visit for puppies under 6 months.',
    description:
      'Short, positive session to get puppies used to water, dryers and handling. Includes a mini bath, paw tidy and lots of treats.',
    price: 700,
    minutes: 40,
    pets: ['dog'],
    image: 'gallery-terrier.jpg',
    popularity: 4,
  },
  {
    category: 'grooming',
    name: 'Cat Lion Cut',
    short: 'Mat-free summer cut for long-haired cats.',
    description:
      'Done by our cat specialist in a quiet room. Recommended for Persians and other long-haired breeds in hot months.',
    price: 2200,
    minutes: 75,
    pets: ['cat'],
    vaccination: true,
    image: 'gallery-paw.jpg',
    popularity: 3,
  },
  {
    category: 'grooming',
    name: 'Nail Trim & Paw Care',
    short: 'Nails, paw pads and paw balm in 15 minutes.',
    description: 'Quick nail trim, pad hair tidy and a nourishing paw balm.',
    price: 350,
    minutes: 20,
    pets: ['dog', 'cat', 'rabbit', 'bird'],
    image: 'gallery-beagle.jpg',
    popularity: 6,
  },
  {
    category: 'spa',
    name: 'Aromatherapy Spa',
    short: 'Massage, aromatherapy and a premium coat mask.',
    description:
      'A calming full-body massage with pet-safe essential oils, a deep-conditioning coat mask and a blueberry facial.',
    price: 2500,
    discount: 2100,
    minutes: 60,
    pets: ['dog', 'cat'],
    featured: true,
    image: 'service-spa.jpg',
    popularity: 5,
  },
  {
    category: 'spa',
    name: 'De-shedding Treatment',
    short: 'Cuts shedding by up to 80% for 4–6 weeks.',
    description:
      'Special shampoo, conditioner and high-velocity blow-out that removes the loose undercoat.',
    price: 1600,
    minutes: 60,
    pets: ['dog', 'cat'],
    image: 'gallery-collie.jpg',
    popularity: 4,
  },
  {
    category: 'walking',
    name: 'Dog Walking (30 min)',
    short: 'A 30-minute neighbourhood walk with photo updates.',
    description: 'One-to-one walk, fresh water and a quick paw wipe at the door.',
    price: 400,
    minutes: 30,
    pets: ['dog'],
    image: 'service-walking.jpg',
    popularity: 7,
  },
  {
    category: 'walking',
    name: 'Adventure Walk (60 min)',
    short: 'An hour of park time for high-energy dogs.',
    description:
      'Longer walk with fetch and sniff time in a nearby park. Great for retrievers, huskies and young dogs.',
    price: 700,
    minutes: 60,
    pets: ['dog'],
    featured: true,
    image: 'pet-gallery-3.jpg',
    popularity: 5,
  },
  {
    category: 'sitting',
    name: 'Pet Sitting (Full Day)',
    short: 'Feeding, play and company at your home.',
    description:
      'Up to 3 visits during the day: meals, fresh water, litter or walk, playtime and photo updates.',
    price: 1500,
    minutes: 480,
    pets: ['dog', 'cat', 'bird', 'rabbit', 'fish'],
    image: 'service-sitting.jpg',
    popularity: 3,
  },
  {
    category: 'sitting',
    name: 'Drop-in Visit',
    short: 'A 30-minute check-in for feeding and cuddles.',
    description: 'Ideal for cats and small pets when you are out for the day.',
    price: 450,
    minutes: 30,
    pets: ['cat', 'bird', 'rabbit', 'fish'],
    image: 'pet-gallery-2.jpg',
    popularity: 4,
  },
  {
    category: 'daycare',
    name: 'Doggy Daycare (Half Day)',
    short: 'Four hours of supervised play and rest.',
    description: 'Play groups by size and energy, nap time and a snack. Vaccination card required.',
    price: 800,
    minutes: 240,
    pets: ['dog'],
    vaccination: true,
    image: 'service-daycare.jpg',
    popularity: 4,
  },
  {
    category: 'daycare',
    name: 'Doggy Daycare (Full Day)',
    short: 'A full day of play, rest and friends.',
    description:
      'Drop off in the morning, pick up a happy, tired dog in the evening. Includes lunch and a nap.',
    price: 1300,
    discount: 1150,
    minutes: 480,
    pets: ['dog'],
    vaccination: true,
    image: 'gallery-glasses.jpg',
    popularity: 3,
  },
  {
    category: 'training',
    name: 'Puppy Manners Class',
    short: 'Sit, stay, recall and leash basics.',
    description:
      'One-to-one session with a positive-reinforcement trainer, with homework for the week.',
    price: 1200,
    minutes: 60,
    pets: ['dog'],
    image: 'gallery-glasses.jpg',
    popularity: 3,
  },
  {
    category: 'training',
    name: 'Behaviour Consultation',
    short: 'Help with barking, pulling or anxiety.',
    description: 'A 90-minute assessment and a written plan tailored to your dog.',
    price: 2000,
    minutes: 90,
    pets: ['dog'],
    image: 'gallery-terrier.jpg',
    popularity: 2,
  },
];

export const PET_NAMES = {
  dog: [
    'Bella',
    'Max',
    'Rocky',
    'Buddy',
    'Coco',
    'Leo',
    'Daisy',
    'Bruno',
    'Simba',
    'Lucy',
    'Tiger',
    'Milo',
    'Luna',
    'Oscar',
    'Bolt',
    'Ruby',
    'Toby',
    'Lily',
  ],
  cat: [
    'Mishti',
    'Tom',
    'Kitty',
    'Shadow',
    'Snowy',
    'Ginger',
    'Pumpkin',
    'Mochi',
    'Bagha',
    'Nala',
    'Oreo',
    'Cleo',
  ],
  rabbit: ['Bunny', 'Thumper', 'Cotton', 'Hazel'],
  bird: ['Mithu', 'Kiwi', 'Sunny', 'Blue'],
  fish: ['Nemo', 'Goldie'],
} as const;

export const BREEDS = {
  dog: [
    'Golden Retriever',
    'Labrador',
    'German Shepherd',
    'Shih Tzu',
    'Pomeranian',
    'Beagle',
    'Husky',
    'Deshi',
    'Poodle',
    'Spitz',
  ],
  cat: ['Persian', 'Deshi', 'Siamese', 'British Shorthair', 'Bengal', 'Maine Coon'],
  rabbit: ['Holland Lop', 'Lionhead', 'Dutch'],
  bird: ['Budgerigar', 'Cockatiel', 'Lovebird'],
  fish: ['Goldfish', 'Betta'],
} as const;

/** Adoptable pets. status: how the story ends up in the seed (applications/adoptions follow it). */
export const ADOPTION_PETS: {
  name: string;
  type: 'dog' | 'cat' | 'rabbit' | 'bird';
  breed: string;
  gender: 'male' | 'female';
  ageMonths: number;
  size: 'small' | 'medium' | 'large';
  color: string;
  fee: number;
  vaccinated: boolean;
  neutered: boolean;
  status: 'available' | 'pending' | 'adopted' | 'on_hold';
  featured?: boolean;
  images: string[];
  story: string;
  health: string;
}[] = [
  {
    name: 'Max',
    type: 'dog',
    breed: 'Golden Retriever',
    gender: 'male',
    ageMonths: 26,
    size: 'large',
    color: 'Golden',
    fee: 3500,
    vaccinated: true,
    neutered: true,
    status: 'available',
    featured: true,
    images: ['gallery-puppy.jpg', 'hero-grooming.jpg'],
    story:
      'Max was surrendered when his family moved abroad. He is a gentle giant who loves fetch, belly rubs and children.',
    health: 'Healthy, fully vaccinated and dewormed. Microchipped.',
  },
  {
    name: 'Bella',
    type: 'dog',
    breed: 'Beagle',
    gender: 'female',
    ageMonths: 18,
    size: 'medium',
    color: 'Tricolour',
    fee: 3000,
    vaccinated: true,
    neutered: true,
    status: 'available',
    featured: true,
    images: ['gallery-beagle.jpg'],
    story:
      'Bella is a curious nose-first explorer. She walks well on a leash and gets along with other dogs.',
    health: 'Healthy. Spayed. Vaccinations up to date.',
  },
  {
    name: 'Coco',
    type: 'dog',
    breed: 'Deshi',
    gender: 'female',
    ageMonths: 10,
    size: 'medium',
    color: 'Brown',
    fee: 0,
    vaccinated: true,
    neutered: false,
    status: 'available',
    featured: true,
    images: ['gallery-terrier.jpg'],
    story:
      'Rescued from a construction site as a puppy, Coco is playful, smart and very loyal. Free to a loving home.',
    health: 'Healthy. First vaccines done, booster due next month.',
  },
  {
    name: 'Rocky',
    type: 'dog',
    breed: 'German Shepherd',
    gender: 'male',
    ageMonths: 40,
    size: 'large',
    color: 'Black & tan',
    fee: 4000,
    vaccinated: true,
    neutered: true,
    status: 'available',
    images: ['gallery-collie.jpg'],
    story:
      'Rocky is a calm, well-trained adult who knows sit, stay and down. Best with an experienced owner and a yard.',
    health: 'Healthy. Mild hip stiffness — joint supplement recommended.',
  },
  {
    name: 'Leo',
    type: 'dog',
    breed: 'Pomeranian',
    gender: 'male',
    ageMonths: 30,
    size: 'small',
    color: 'Orange',
    fee: 2500,
    vaccinated: true,
    neutered: true,
    status: 'available',
    images: ['pet-gallery-1.jpg'],
    story:
      'Small dog, big personality. Leo loves laps and short walks and is perfect for apartment life.',
    health: 'Healthy. Dental cleaning done last month.',
  },
  {
    name: 'Daisy',
    type: 'dog',
    breed: 'Labrador',
    gender: 'female',
    ageMonths: 6,
    size: 'medium',
    color: 'Yellow',
    fee: 3000,
    vaccinated: true,
    neutered: false,
    status: 'available',
    images: ['service-daycare.jpg'],
    story:
      'A happy puppy who is learning house manners fast. Daisy will grow into a wonderful family dog.',
    health: 'Healthy puppy. Vaccination course in progress.',
  },
  {
    name: 'Bruno',
    type: 'dog',
    breed: 'Deshi',
    gender: 'male',
    ageMonths: 48,
    size: 'medium',
    color: 'Fawn',
    fee: 0,
    vaccinated: true,
    neutered: true,
    status: 'on_hold',
    images: ['pet-gallery-3.jpg'],
    story:
      'Bruno is recovering from a leg injury and will be ready for adoption soon. He is sweet and calm.',
    health: 'Recovering from a fractured leg — cleared for adoption in 2 weeks.',
  },
  {
    name: 'Simba',
    type: 'dog',
    breed: 'Husky',
    gender: 'male',
    ageMonths: 22,
    size: 'large',
    color: 'Grey & white',
    fee: 4500,
    vaccinated: true,
    neutered: true,
    status: 'pending',
    images: ['service-walking.jpg'],
    story:
      'Simba needs an active family and an air-conditioned room — he loves runs and winter mornings.',
    health: 'Healthy. Needs a cool environment.',
  },
  {
    name: 'Lucy',
    type: 'dog',
    breed: 'Shih Tzu',
    gender: 'female',
    ageMonths: 60,
    size: 'small',
    color: 'White & brown',
    fee: 2000,
    vaccinated: true,
    neutered: true,
    status: 'adopted',
    images: ['service-grooming.jpg'],
    story: 'Lucy is a calm senior lady who loves naps and gentle brushing.',
    health: 'Healthy senior. Regular grooming needed.',
  },
  {
    name: 'Toby',
    type: 'dog',
    breed: 'Spitz',
    gender: 'male',
    ageMonths: 14,
    size: 'small',
    color: 'White',
    fee: 2500,
    vaccinated: true,
    neutered: false,
    status: 'adopted',
    images: ['gallery-glasses.jpg'],
    story: 'Toby is cheerful and chatty. He found his family through PetPlex!',
    health: 'Healthy.',
  },
  {
    name: 'Mishti',
    type: 'cat',
    breed: 'Persian',
    gender: 'female',
    ageMonths: 20,
    size: 'small',
    color: 'White',
    fee: 3000,
    vaccinated: true,
    neutered: true,
    status: 'available',
    featured: true,
    images: ['gallery-paw.jpg'],
    story: 'Mishti is a quiet, affectionate Persian who enjoys sunny windows and daily brushing.',
    health: 'Healthy. Needs daily coat care.',
  },
  {
    name: 'Bagha',
    type: 'cat',
    breed: 'Deshi',
    gender: 'male',
    ageMonths: 12,
    size: 'small',
    color: 'Orange tabby',
    fee: 0,
    vaccinated: true,
    neutered: true,
    status: 'available',
    images: ['pet-gallery-2.jpg'],
    story:
      'Bagha was found on a rainy night in Dhanmondi. Now he is a confident, playful young tabby.',
    health: 'Healthy. Neutered and vaccinated.',
  },
  {
    name: 'Snowy',
    type: 'cat',
    breed: 'Siamese',
    gender: 'female',
    ageMonths: 8,
    size: 'small',
    color: 'Seal point',
    fee: 2000,
    vaccinated: true,
    neutered: false,
    status: 'available',
    images: ['service-sitting.jpg'],
    story: 'Snowy is talkative and loves to follow you around the house.',
    health: 'Healthy kitten. Spay scheduled at 9 months.',
  },
  {
    name: 'Shadow',
    type: 'cat',
    breed: 'British Shorthair',
    gender: 'male',
    ageMonths: 36,
    size: 'medium',
    color: 'Blue grey',
    fee: 3500,
    vaccinated: true,
    neutered: true,
    status: 'available',
    images: ['service-spa.jpg'],
    story: 'Shadow is laid-back and independent — the perfect cat for a working household.',
    health: 'Healthy.',
  },
  {
    name: 'Ginger',
    type: 'cat',
    breed: 'Deshi',
    gender: 'female',
    ageMonths: 4,
    size: 'small',
    color: 'Ginger',
    fee: 0,
    vaccinated: false,
    neutered: false,
    status: 'available',
    images: ['pet-gallery-2.jpg'],
    story: 'A tiny bundle of energy rescued with her siblings. She will need a kitten-proof home.',
    health: 'Healthy. First vaccine due next week.',
  },
  {
    name: 'Cleo',
    type: 'cat',
    breed: 'Bengal',
    gender: 'female',
    ageMonths: 28,
    size: 'medium',
    color: 'Spotted brown',
    fee: 4000,
    vaccinated: true,
    neutered: true,
    status: 'pending',
    images: ['gallery-paw.jpg'],
    story: 'Cleo is athletic and clever — she plays fetch and loves climbing towers.',
    health: 'Healthy.',
  },
  {
    name: 'Oreo',
    type: 'cat',
    breed: 'Deshi',
    gender: 'male',
    ageMonths: 44,
    size: 'medium',
    color: 'Black & white',
    fee: 1000,
    vaccinated: true,
    neutered: true,
    status: 'adopted',
    images: ['service-spa.jpg'],
    story: 'Oreo is a gentle lap cat who now lives with a lovely family in Uttara.',
    health: 'Healthy.',
  },
  {
    name: 'Nala',
    type: 'cat',
    breed: 'Maine Coon',
    gender: 'female',
    ageMonths: 16,
    size: 'large',
    color: 'Brown tabby',
    fee: 5000,
    vaccinated: true,
    neutered: true,
    status: 'adopted',
    images: ['service-sitting.jpg'],
    story: 'Nala is a fluffy gentle giant.',
    health: 'Healthy.',
  },
  {
    name: 'Mochi',
    type: 'cat',
    breed: 'Deshi',
    gender: 'male',
    ageMonths: 7,
    size: 'small',
    color: 'Cream',
    fee: 0,
    vaccinated: true,
    neutered: false,
    status: 'on_hold',
    images: ['pet-gallery-2.jpg'],
    story:
      'Mochi is shy at first but melts once he trusts you. Currently in foster while he recovers from a cold.',
    health: 'Recovering from a mild respiratory infection.',
  },
  {
    name: 'Hazel',
    type: 'rabbit',
    breed: 'Holland Lop',
    gender: 'female',
    ageMonths: 9,
    size: 'small',
    color: 'Brown',
    fee: 1500,
    vaccinated: false,
    neutered: true,
    status: 'available',
    images: [],
    story: 'Hazel loves fresh greens and binkies around the living room. Litter trained.',
    health: 'Healthy. Spayed.',
  },
  {
    name: 'Cotton',
    type: 'rabbit',
    breed: 'Lionhead',
    gender: 'male',
    ageMonths: 14,
    size: 'small',
    color: 'White',
    fee: 1500,
    vaccinated: false,
    neutered: true,
    status: 'available',
    images: [],
    story: 'Cotton is calm and enjoys being brushed. Great first rabbit.',
    health: 'Healthy. Neutered.',
  },
  {
    name: 'Kiwi',
    type: 'bird',
    breed: 'Cockatiel',
    gender: 'male',
    ageMonths: 24,
    size: 'small',
    color: 'Grey & yellow',
    fee: 1200,
    vaccinated: false,
    neutered: false,
    status: 'available',
    images: [],
    story: 'Kiwi whistles the first notes of a Rabindra Sangeet and loves head scratches.',
    health: 'Healthy.',
  },
  {
    name: 'Sunny',
    type: 'bird',
    breed: 'Lovebird',
    gender: 'female',
    ageMonths: 12,
    size: 'small',
    color: 'Green & peach',
    fee: 800,
    vaccinated: false,
    neutered: false,
    status: 'adopted',
    images: [],
    story: 'Sunny went home with her best friend Blue.',
    health: 'Healthy.',
  },
];

export const BLOG_CATEGORIES = [
  { name: 'Grooming tips', slug: 'grooming-tips' },
  { name: 'Pet health', slug: 'pet-health' },
  { name: 'Adoption stories', slug: 'adoption-stories' },
  { name: 'Training & behaviour', slug: 'training-behaviour' },
] as const;

const md = (intro: string, sections: [string, string[]][], tip: string) =>
  `${intro}\n\n${sections.map(([h, items]) => `## ${h}\n\n${items.map((i) => `- ${i}`).join('\n')}`).join('\n\n')}\n\n> **Tip:** ${tip}\n\nWant help from our team? [Book a visit](/services) or [ask us a question](/#contact).`;

/** daysAgo < 0 = scheduled in the future; null = draft */
export const BLOG_POSTS: {
  title: string;
  category: string;
  excerpt: string;
  cover: string;
  daysAgo: number | null;
  content: string;
}[] = [
  {
    title: '5 grooming habits every dog needs',
    category: 'grooming-tips',
    cover: 'service-grooming.jpg',
    daysAgo: 3,
    excerpt:
      'Small weekly habits that keep coats shiny, skin healthy and grooming visits stress-free.',
    content: md(
      'Regular grooming is about health as much as looks. These five habits take a few minutes a week and make a big difference.',
      [
        [
          'Every week',
          [
            'Brush 2–3 times — daily for long coats',
            'Check ears for smell or redness',
            'Wipe paws after walks in the rain',
          ],
        ],
        [
          'Every month',
          [
            'Trim nails (or book a quick trim)',
            'Bath with a pet-safe shampoo — never human shampoo',
          ],
        ],
      ],
      'Reward with a treat after every session so your dog looks forward to grooming.',
    ),
  },
  {
    title: 'Keeping your pet cool in Dhaka summers',
    category: 'pet-health',
    cover: 'service-walking.jpg',
    daysAgo: 12,
    excerpt:
      'Heat stroke is common in May and June. Here is how to keep dogs and cats safe and comfortable.',
    content: md(
      'Temperatures above 35°C are dangerous for pets, especially flat-faced breeds and thick-coated dogs.',
      [
        [
          'Do',
          [
            'Walk before 8 AM and after sunset',
            'Keep fresh water in two places',
            'Use a damp towel or cooling mat',
          ],
        ],
        [
          'Watch for',
          [
            'Heavy panting and drooling',
            'Bright red gums',
            'Weakness or vomiting — call a vet immediately',
          ],
        ],
      ],
      'Never shave a double-coated dog: the coat protects them from the sun.',
    ),
  },
  {
    title: 'How to keep your cat calm at the groomer',
    category: 'grooming-tips',
    cover: 'gallery-paw.jpg',
    daysAgo: 21,
    excerpt: 'Our cat specialist shares her tricks for a stress-free visit.',
    content: md(
      'Cats are not small dogs — they need a quieter, slower approach.',
      [
        [
          'Before the visit',
          [
            'Leave the carrier out at home for a few days',
            'Spray a calming pheromone in the carrier',
            'Skip the big meal before the appointment',
          ],
        ],
        [
          'At PetPlex',
          [
            'Cats are groomed in a separate, quiet room',
            'We use low-noise dryers and towel drying',
          ],
        ],
      ],
      'Book a morning slot — the studio is quietest before 11 AM.',
    ),
  },
  {
    title: 'Max found his forever family',
    category: 'adoption-stories',
    cover: 'gallery-puppy.jpg',
    daysAgo: 30,
    excerpt: 'From a shelter kennel to a sofa in Banani in three weeks.',
    content: md(
      'When Max arrived he was anxious and underweight. Three weeks later he met the Hossain family.',
      [
        [
          'What helped',
          [
            'Daily walks with the same handler',
            'A quiet foster home for two weeks',
            'A slow, supervised first meeting with the kids',
          ],
        ],
      ],
      'Adopted pets need a few weeks to settle — patience pays off.',
    ),
  },
  {
    title: 'Vaccination schedule for puppies and kittens',
    category: 'pet-health',
    cover: 'gallery-terrier.jpg',
    daysAgo: 45,
    excerpt: 'Which vaccines, when — and why daycare asks for the card.',
    content: md(
      'Vaccines protect your pet and every other pet they meet.',
      [
        [
          'Puppies',
          ['6–8 weeks: first combination vaccine', '10–12 weeks: booster', '12–16 weeks: rabies'],
        ],
        [
          'Kittens',
          ['8 weeks: first combination vaccine', '12 weeks: booster', '16 weeks: rabies'],
        ],
      ],
      'Bring the vaccination card to your first daycare visit.',
    ),
  },
  {
    title: 'Leash training in 7 days',
    category: 'training-behaviour',
    cover: 'pet-gallery-1.jpg',
    daysAgo: 60,
    excerpt: 'A simple day-by-day plan to stop pulling on walks.',
    content: md(
      'Pulling is the most common walking problem — and one of the easiest to fix with consistency.',
      [
        [
          'Days 1–3',
          [
            'Practise indoors with treats at your side',
            'Stop moving whenever the leash goes tight',
          ],
        ],
        ['Days 4–7', ['Move to a quiet street', 'Reward every few steps of loose leash']],
      ],
      'Short, happy sessions beat one long frustrating walk.',
    ),
  },
  {
    title: 'Why de-shedding matters before monsoon',
    category: 'grooming-tips',
    cover: 'gallery-collie.jpg',
    daysAgo: 75,
    excerpt: 'Damp weather plus a dense undercoat equals skin problems. Here is the fix.',
    content: md(
      'A trapped undercoat holds moisture against the skin during the rainy season.',
      [
        [
          'Signs your pet needs it',
          ['Tufts of hair on the sofa', 'Itchy, flaky skin', 'A musty smell after walks'],
        ],
      ],
      'A de-shedding treatment every 6 weeks keeps the coat breathable.',
    ),
  },
  {
    title: 'Bagha the rainy-night rescue',
    category: 'adoption-stories',
    cover: 'pet-gallery-2.jpg',
    daysAgo: 90,
    excerpt: 'How a soaked kitten from Dhanmondi became the studio mascot.',
    content: md(
      'One rainy night our team found a tiny orange kitten under a rickshaw.',
      [
        [
          'His recovery',
          [
            'Two weeks of bottle feeding',
            'First vaccines and a clean bill of health',
            'Lots of naps on the reception desk',
          ],
        ],
      ],
      'Bagha is now ready for his own family — meet him on the Adopt page.',
    ),
  },
  {
    title: 'Separation anxiety: signs and solutions',
    category: 'training-behaviour',
    cover: 'service-sitting.jpg',
    daysAgo: 110,
    excerpt: 'Barking, chewing and accidents when you leave? It may be anxiety, not mischief.',
    content: md(
      'Many dogs adopted during busy periods struggle when routines change.',
      [
        [
          'Try this',
          [
            'Practise short absences and slowly increase them',
            'Leave a puzzle feeder when you go',
            'Consider daycare on long office days',
          ],
        ],
      ],
      'Never punish anxious behaviour — it makes the fear worse.',
    ),
  },
  {
    title: 'Choosing the right food for your senior dog',
    category: 'pet-health',
    cover: 'pet-gallery-3.jpg',
    daysAgo: 140,
    excerpt: 'Older dogs need fewer calories but more care. A quick guide.',
    content: md(
      'From around 7 years, most dogs slow down and their needs change.',
      [
        [
          'Look for',
          [
            'Lower calories with high-quality protein',
            'Joint support (glucosamine, omega-3)',
            'Easy-to-chew kibble or wet food',
          ],
        ],
      ],
      'Ask your vet before switching food, and change it gradually over a week.',
    ),
  },
  {
    title: 'Winter care checklist for pets',
    category: 'pet-health',
    cover: 'service-sitting.jpg',
    daysAgo: -5,
    excerpt: 'Short coats, older pets and kittens feel the cold first. Get ready for December.',
    content: md(
      'Dhaka winters are mild, but early mornings can be chilly for small and senior pets.',
      [
        [
          'Checklist',
          [
            'A warm bed off the floor',
            'A sweater for short-haired small dogs',
            'Moisturising paw balm',
          ],
        ],
      ],
      'Keep heaters at a safe distance from curious noses.',
    ),
  },
  {
    title: 'Draft: Fireworks and festival anxiety',
    category: 'training-behaviour',
    cover: 'gallery-glasses.jpg',
    daysAgo: null,
    excerpt: 'How to prepare pets for loud nights.',
    content: md(
      'Loud celebrations can terrify pets.',
      [['Plan ahead', ['Create a quiet den', 'Play calm music', 'Keep ID tags on']]],
      'Talk to your vet about calming options well in advance.',
    ),
  },
];

export const FAQS: { q: string; a: string; category: string }[] = [
  {
    q: 'How do I book an appointment?',
    a: 'Choose a service, select your pet, then pick a date and a free time slot. It takes about a minute, and you get a confirmation by email.',
    category: 'booking',
  },
  {
    q: 'Can I cancel or reschedule?',
    a: 'Yes. You can cancel for free from your dashboard up to 24 hours before the appointment. To reschedule, cancel and book a new slot.',
    category: 'booking',
  },
  {
    q: 'Do I need to bring a vaccination card?',
    a: 'For daycare and some cat services, yes — we need to see an up-to-date vaccination card. It keeps every pet in the studio safe.',
    category: 'booking',
  },
  {
    q: 'Which payment methods do you accept?',
    a: 'Pay online with bKash, Nagad, Rocket, cards or internet banking through SSLCommerz, or pay cash/card at the counter.',
    category: 'payment',
  },
  {
    q: 'Do you offer refunds?',
    a: 'If you cancel in time, online payments are refunded to the original method within 7–10 working days.',
    category: 'payment',
  },
  {
    q: 'Do you groom cats?',
    a: 'Absolutely. Cats are groomed by our cat specialist in a separate quiet room with low-noise dryers.',
    category: 'grooming',
  },
  {
    q: 'How long does a full groom take?',
    a: 'Usually 1.5–2 hours depending on size and coat. We will message you when your pet is ready.',
    category: 'grooming',
  },
  {
    q: 'My dog is nervous. Can you help?',
    a: 'Yes. Mention it in the booking note — we will schedule a quieter slot and go slowly with lots of breaks.',
    category: 'grooming',
  },
  {
    q: 'How does adoption work?',
    a: 'Apply online for the pet you like. Our team reviews the application and calls you, then you meet the pet. Once approved you pay the adoption fee and take your new friend home.',
    category: 'adoption',
  },
  {
    q: 'What does the adoption fee cover?',
    a: 'Vaccinations, deworming, a health check and microchipping. Some rescues are free to a loving home.',
    category: 'adoption',
  },
  {
    q: 'Can I return an adopted pet?',
    a: 'We hope you never need to, but if it does not work out, please contact us — we will always take the pet back.',
    category: 'adoption',
  },
  {
    q: 'Where are you located?',
    a: 'Our studio is in Dhaka. See the contact section for the address, opening hours and a map link.',
    category: 'general',
  },
];

export const TESTIMONIALS: {
  name: string;
  content: string;
  rating: number;
  featured: boolean;
  image?: string;
}[] = [
  {
    name: 'Sadia Rahman',
    content:
      'PetPlex transformed Buddy! The grooming was exceptional and the staff were so caring. He came home smelling amazing.',
    rating: 5,
    featured: true,
  },
  {
    name: 'Tanvir Ahmed',
    content:
      'Booking took under a minute and Whiskers came home looking like a show cat. Paying with bKash was super easy.',
    rating: 5,
    featured: true,
  },
  {
    name: 'Nusrat Jahan',
    content:
      'We adopted Toby through PetPlex — the process was clear, kind and quick. They even called after a week to check on him.',
    rating: 5,
    featured: true,
  },
  {
    name: 'Fahim Chowdhury',
    content:
      'Daycare has been a lifesaver on office days. Rocky comes home tired and happy every time.',
    rating: 5,
    featured: true,
  },
  {
    name: 'Ayesha Siddiqui',
    content:
      'My Persian hates water, but the cat specialist was so patient. First stress-free groom ever!',
    rating: 5,
    featured: true,
  },
  {
    name: 'Imran Hossain',
    content: 'Great service and fair prices. Only wish they had more Saturday slots.',
    rating: 4,
    featured: true,
  },
  {
    name: 'Farzana Karim',
    content: 'The behaviour consultation helped us fix leash pulling in two weeks.',
    rating: 5,
    featured: false,
  },
  {
    name: 'Arif Haque',
    content: 'Friendly team and a very clean studio.',
    rating: 4,
    featured: false,
  },
];

export const GALLERY_ALBUMS: {
  title: string;
  slug: string;
  description: string;
  cover: string;
  items: [string, string][];
}[] = [
  {
    title: 'Grooming day',
    slug: 'grooming-day',
    description: 'Fresh cuts and happy faces.',
    cover: 'service-grooming.jpg',
    items: [
      ['service-grooming.jpg', 'Golden retriever after a full groom'],
      ['gallery-puppy.jpg', 'Puppy first groom'],
      ['gallery-terrier.jpg', 'Terrier trim'],
      ['gallery-collie.jpg', 'Collie de-shed'],
      ['hero-grooming.jpg', 'Bath time'],
    ],
  },
  {
    title: 'Spa days',
    slug: 'spa-days',
    description: 'Massages, masks and very relaxed pets.',
    cover: 'service-spa.jpg',
    items: [
      ['service-spa.jpg', 'Aromatherapy session'],
      ['gallery-paw.jpg', 'Paw care'],
      ['pet-gallery-2.jpg', 'Relaxing after a massage'],
    ],
  },
  {
    title: 'Out and about',
    slug: 'out-and-about',
    description: 'Walks, play and daycare friends.',
    cover: 'service-walking.jpg',
    items: [
      ['service-walking.jpg', 'Morning walk crew'],
      ['service-daycare.jpg', 'Daycare nap time'],
      ['pet-gallery-1.jpg', 'Fresh from the groomer'],
      ['pet-gallery-3.jpg', 'Fetch champion'],
      ['gallery-beagle.jpg', 'Beagle on a sniff walk'],
    ],
  },
  {
    title: 'Adopted & happy',
    slug: 'adopted-and-happy',
    description: 'Rescues in their forever homes.',
    cover: 'gallery-glasses.jpg',
    items: [
      ['gallery-glasses.jpg', 'Max settling in'],
      ['service-sitting.jpg', 'Best friends at home'],
      ['gallery-paw.jpg', 'High five from Oreo'],
    ],
  },
];

export const CONTACT_SUBJECTS: [string, string][] = [
  [
    'Grooming for a senior dog',
    'My dog is 12 and has arthritis. Can your groomer handle him gently? He gets anxious on tables.',
  ],
  [
    'Corporate pet-day event',
    'We would like to arrange a pet day at our office in Gulshan for 20 employees. Do you offer packages?',
  ],
  [
    'Question about adoption fee',
    'Does the adoption fee for Max include microchipping? Also, can we meet him this weekend?',
  ],
  [
    'Home grooming available?',
    'Do you offer grooming at home in Uttara? My cat does not travel well.',
  ],
  [
    'Feedback on my visit',
    'Thank you for the great job with Coco yesterday — she looks beautiful!',
  ],
  [
    'Payment issue',
    'I paid with bKash but the booking still shows unpaid. Transaction ID attached in my email.',
  ],
  [
    'Volunteer opportunities',
    'I am a vet student and would love to volunteer with your rescue team on weekends.',
  ],
  [
    'Daycare availability in December',
    'Do you have full-day daycare slots during the second week of December?',
  ],
  [
    'Partnership enquiry',
    'We run a pet food brand in Dhaka and would like to discuss a partnership for your customers.',
  ],
  [
    'Lost booking confirmation',
    'I did not receive the confirmation email for my booking on Saturday. Can you resend it?',
  ],
];

export const REVIEW_TEXT: { rating: number; title: string | null; comment: string }[] = [
  {
    rating: 5,
    title: 'Absolutely loved it',
    comment: 'Super gentle team and my dog came home fluffy and calm. Booking took a minute.',
  },
  {
    rating: 5,
    title: 'Best groomer in Dhaka',
    comment: 'Very professional, clean studio and they sent photo updates the whole time.',
  },
  {
    rating: 5,
    title: 'Stress-free for my cat',
    comment: 'The cat specialist was so patient. No scratches, no stress, beautiful result.',
  },
  {
    rating: 5,
    title: 'Worth every taka',
    comment: 'Great value with the discount. Will definitely book again next month.',
  },
  {
    rating: 4,
    title: 'Great cut, a little wait',
    comment: 'Really good grooming. We waited 15 minutes at drop-off, otherwise perfect.',
  },
  {
    rating: 4,
    title: 'Happy and tired pup',
    comment: 'He loved the walk and slept all evening. Would like a longer route next time.',
  },
  { rating: 4, title: 'Good but busy', comment: 'Lovely staff. Weekends are busy, so book early.' },
  {
    rating: 3,
    title: 'Okay experience',
    comment: 'The groom was fine but the haircut was shorter than I asked for.',
  },
  {
    rating: 5,
    title: 'Daycare is a lifesaver',
    comment: 'Rocky comes home happy every time. The staff clearly love dogs.',
  },
  { rating: 5, title: null, comment: 'Excellent service as always!' },
  {
    rating: 2,
    title: 'Not happy this time',
    comment: 'Shampoo smell was too strong for my cat and she was itchy afterwards.',
  },
  {
    rating: 5,
    title: 'Amazing spa day',
    comment: 'The aromatherapy spa is pure luxury. My Shih Tzu looked like a cloud.',
  },
];

export const ADMIN_REPLIES = [
  'Thank you so much! It was a pleasure — see you both next time 🐾',
  'Thanks for the kind words! We will pass them on to the team.',
  'Sorry about the wait — we have added more weekend staff. Thanks for your patience!',
  'Thank you for the feedback. We have noted your preference for next time.',
  'We are sorry to hear that. We have switched to an unscented shampoo option — please mention it in your next booking.',
];
