import random


class RandomNameGenerator:
    _ANIMALS = [
        "Alpaca", "Antelope", "Armadillo", "Beaver", "Bee",
        "Bison", "Butterfly", "Caribou", "Caterpillar", "Chamois",
        "Chinchilla", "Chough", "Cormorant", "Crane", "Curlew", "Deer", "Dolphin",
        "Dotterel", "Dove", "Dragonfly", "Duck", "Dunlin", "Eagle", "Echidna",
        "Eland", "Elephant", "Elk", "Emu", "Falcon", "Flamingo", "Finch", "Gazelle",
        "Gerbil", "Giraffe", "Grasshopper", "Hamster",
        "Hedgehog", "Heron", "Hummingbird", "Ibex", "Ibis", "Jaguar", "Koala",
        "Kudu", "Lapwing", "Lark", "Lemur", "Leopard", "Lion",
        "Lobster", "Lyrebird", "Mallard", "Marten", "Meerkat", "Moose",
        "Newt", "Nightingale", "Okapi", "Oryx", "Otter", "Owl", "Panther", "Partridge",
        "Pelican", "Penguin", "Pony", "Quelea", "Quetzal", "Panda",
        "Reindeer", "Salamander", "Salmon", "Sandpiper", "Seahorse", "Seal", "Sparrow",
        "Squid", "Squirrel", "Starling", "Stork", "Swan",
        "Wallaby", "Wombat", "Woodcock", "Wren", "Zebra"
    ]
    _ADJECTIVES = [
        "Agile", "Brave", "Bright", "Calm", "Clever",
        "Curious", "Dazzling", "Elegant",
        "Friendly", "Gentle", "Graceful", "Happy", "Lively",
        "Majestic", "Mighty", "Mysterious", "Noble", "Playful", "Proud", "Quick",
        "Quiet", "Radiant", "Rare", "Rapid", "Restless",
        "Sleek", "Spirited",
        "Spotted", "Stealthy", "Swift", "Wild", "Wise"
    ]
    _CITIES = [
        "Berlin", "Hamburg", "München", "Köln", "Frankfurt",
        "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig",
        "Bremen", "Dresden", "Hannover", "Nürnberg", "Bochum",
        "Wuppertal", "Bielefeld", "Bonn", "Mannheim", "Karlsruhe",
        "Wiesbaden", "Münster", "Augsburg", "Gelsenkirchen", "Braunschweig",
        "Chemnitz", "Kiel", "Aachen", "Magdeburg", "Freiburg",
        "Erfurt", "Mainz", "Rostock", "Krefeld", "Lübeck",
        "Heilbronn", "Oberhausen", "Potsdam", "Saarbrücken", "Regensburg",
        "Ingolstadt", "Ulm", "Würzburg", "Hildesheim", "Osnabrück",
        "Oldenburg", "Solingen", "Recklinghausen", "Ludwigshafen", "Cottbus"
    ]

    def __init__(self):
        pass

    @staticmethod
    def generate_examinee_name(already_taken=None):
        found = False
        while not found:
            adjective = random.choice(RandomNameGenerator._ADJECTIVES)
            animal = random.choice(RandomNameGenerator._ANIMALS)
            if already_taken is not None and (adjective, animal) not in already_taken:
                found = True

            if found or already_taken is None:
                return adjective, animal

    @staticmethod
    def generate_grader_pseudonym(already_taken=None):
        available = RandomNameGenerator._CITIES
        if already_taken is not None:
            available = list(set(RandomNameGenerator._CITIES).difference(already_taken))

        if len(available) == 0:
            raise ValueError("Cannot choose a grader name as all names are taken")

        return random.choice(available)
