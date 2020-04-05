import re
import os

flist = os.listdir('D:\\Projects\\blog\\excitedFrog.github.io\\ProjData\\')
flist = list(map(lambda x: os.path.join('D:\\Projects\\blog\\excitedFrog.github.io\\ProjData\\', x), flist))
for path in flist:
    print(path)
    with open(path, 'r') as f:
        s = f.read()
    s = re.sub('NaN,', 'null,', s)
    s = re.sub('NaN]', 'null]', s)
    with open(path, 'w') as f:
        f.write(s)
