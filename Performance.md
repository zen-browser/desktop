# 🌀 Zen Browser Performance traker
```mermaid
  graph TD;
    A[mauro-balades] -->B(Zen custom code)
    G-->B
    H(ptr1337/CachyOS)-->|AUR Pkg and Opt. flags|D
    E(Fire Fox-Code)-->C
    B --> C{Final code}
    D-->G(Perf. Testing)
    C-->D(Build)
    D--> F(Release)
    F-->I(mar)
    F-->L(Mac)
    F-->T(Linux)
    F-->V(Win install)
    V-->Z(Zip)
    V-->Z2(Intall.exe)
    I-->I1(windows.mar)
    I-->I2(linux.mar)
    I-->I3(macos.mar)
    T-->T1(zen.linux.tar.bz2)
    T-->T2(AUR)
    T-->T3(Flatpak)
    T-->T4(AppImage)
    L-->L1(zen.macos.dmg)
```


## Scores 

## 1
- [NOCanoa ](https://github.com/NOCanoa)

OS: win 11; CPU: i5 13600k

## web.basemark

https://web.basemark.com/

|           | score:  |CSS | HTML5 | Page load and Responsiveness | Resize Cap. |
|-----------|-----|-----|-------|------------------------------|-------------|
| 1.0.0-a.10 | 1660.89 | 59% | 91% | 91% | 76% |
| 1.0.0-a.9 | 470 |  why  | why  | why  | why  |
| 1.0.0-a.8 | 446.74  | 59% | 91%   | 96%                          | 76%         |
| 1.0.0-a.7 | 1964.43 | 59% | 91%   | 91%                          | 76%         |
| 1.0.0-a.6 | 1747.98 | 59% | 91%   | 91%                          | 76%         |
| 1.0.0-a.4 | 470.49  | 59% | 91%   | 97%                          | 76%         |
| 1.0.0-a.3 | 475.52  |59% | 91%   | 97%                          | 76%         |
| other | last | utpdate | 31/7   | 2024                         | -        |
| Librewolf 128.0-2 | 1953.65 | 59.66% | 89.01%   | 91.72%                         | 76.12% |
| FF nightly 130.0a1 | 1912.77 | 59.66% | 90.91%   | 91.72%                         | 76.12% |


```mermaid
xychart-beta
    title "Performance over time (Higher is better)"
    x-axis [.3, .4, .6, .7, .8, .9, .10]
    y-axis "Benchmark Points"
    bar [475.52, 470.49, 1747.98, 1964.43, 446.74, 470, 1660.89]
    line [475.52, 470.49, 1747.98, 1964.43, 446.74, 470, 1660.89]
```

## Speedometer3.0

https://browserbench.org/Speedometer3.0/ 

|           | score:  |
|-----------|-----|
| 1.0.0-a.10 | 21.2 |
| others| - |
| Vivaldi 6.7.3329.39| 27.8 |
| FF nightly 130.0a1 | 27.0 |
| Librewolf 128.0-2 | 20.2 |


## 2

- [Verix](https://github.com/Veriiix)

OS: Win 11
CPU: i7-13700KF
GPU: AMD RX 7900 XTX
https://www.tablesgenerator.com/

| Version    | Score: |
|------------|--------|
| 1.0.0-a.10 | 21.7   |
| 1.0.0-a.9  | 3.7    |

https://browserbench.org/Speedometer3.0/
