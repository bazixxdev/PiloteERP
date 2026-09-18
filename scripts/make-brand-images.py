#!/usr/bin/env python3
"""Images de marque par client (lot I) : logo blanc (fond sombre), favicon (marque 64 px), et placeholders TLST tant que le
vrai logo n'est pas fourni. Relancer après avoir déposé un nouveau logo couleur : python3 scripts/make-brand-images.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent / "public" / "clients"


def whiten(src: Path, dst: Path) -> None:
    """Tous les pixels opaques passent en blanc, l'alpha est gardé : un logo pour fond sombre."""
    im = Image.open(src).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (255, 255, 255, a)
    im.save(dst)


def favicon(mark: Path, dst: Path, size: int = 64) -> None:
    im = Image.open(mark).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    canvas.save(dst)


def wordmark(text: str, color: tuple, size: tuple, dst: Path, font_size: int) -> None:
    """Placeholder : le sigle en gras, centré, fond transparent."""
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf", font_size)
    except OSError:
        font = ImageFont.load_default(size=font_size)
    box = draw.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(((size[0] - w) / 2 - box[0], (size[1] - h) / 2 - box[1]), text, fill=color, font=font)
    im.save(dst)


def main() -> None:
    cress = ROOT / "cress"
    whiten(cress / "logo.png", cress / "logo-white.png")
    favicon(cress / "mark.png", cress / "favicon.png")

    tlst = ROOT / "tlst"
    tlst.mkdir(parents=True, exist_ok=True)
    green = (0, 66, 20, 255)   # vert du logo (#004214), primaire TLST
    source = tlst / "logo-white.png"  # le vrai logo (export du site tierslieusudtouraine.fr, 2024) : blanc + jaune, pour fond sombre
    if source.exists() and Image.open(source).width > 500:
        im = Image.open(source).convert("RGBA")
        im = im.crop(im.getbbox())
        # Version pour fond clair : le blanc devient le vert du logo, le jaune reste.
        color = im.copy(); px = color.load()
        for y in range(color.height):
            for x in range(color.width):
                r, g, b, a = px[x, y]
                if a and r > 235 and g > 235 and b > 235:
                    px[x, y] = (green[0], green[1], green[2], a)
        w = 465; h = round(im.height * w / im.width)
        color.resize((w, h), Image.LANCZOS).save(tlst / "logo.png")
        white = im.resize((w, h), Image.LANCZOS)
        white.save(tlst / "logo-white.png")
        # La marque seule = le pictogramme (les deux personnages et la pousse), en haut du logo.
        picto = im.crop((0, 0, im.width, int(im.height * 0.22)))
        picto = picto.crop(picto.getbbox())
        mw = 190; mh = round(picto.height * mw / picto.width)
        picto.resize((mw, mh), Image.LANCZOS).save(tlst / "mark.png")
        favicon(tlst / "mark.png", tlst / "favicon.png")
        print(f"TLST : logo {w}×{h}, marque {mw}×{mh}")
    else:
        wordmark("TLST", green, (465, 187), tlst / "logo.png", 120)
        wordmark("TLST", (255, 255, 255, 255), (465, 187), tlst / "logo-white.png", 120)
        wordmark("T", green, (190, 177), tlst / "mark.png", 150)
        favicon(tlst / "mark.png", tlst / "favicon.png")
    print("ok :", *sorted(p.relative_to(ROOT.parent) for p in ROOT.rglob("*.png")), sep="\n  ")


if __name__ == "__main__":
    main()
