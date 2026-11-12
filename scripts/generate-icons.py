from pathlib import Path
from PIL import Image, ImageDraw

root = Path('public/icons')
root.mkdir(parents=True, exist_ok=True)
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (512, 'maskable-512.png')]:
    image = Image.new('RGB', (size, size), '#2563eb')
    draw = ImageDraw.Draw(image)
    def point(x, y):
        return (int(size*x), int(size*y))
    points = [point(.5,.22),point(.75,.36),point(.75,.64),point(.5,.78),point(.25,.64),point(.25,.36)]
    draw.line(points+[points[0]], fill='white', width=max(3,size//35), joint='curve')
    draw.line([point(.25,.36),point(.5,.5),point(.75,.36)],fill='white',width=max(3,size//35))
    draw.line([point(.5,.5),point(.5,.78)],fill='white',width=max(3,size//35))
    image.save(root/name)
