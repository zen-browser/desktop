# 🌀 Zen Browser Performance traker

## Scores 

## 1
- [NOCanoa](https://github.com/NOCanoa)

OS: win 11; CPU: i5 13600k

## web.basemark

https://web.basemark.com/

|           | score:  |CSS | HTML5 | Page load and Responsiveness | Resize Cap. |
|-----------|-----|-----|-------|------------------------------|-------------|
| 1.0.0-a.15-opt | 2141.63 | 59% | 91% | 90% | 76% |
| 1.0.0-a.13-opt | 1658.87 | 59% | 91% | 90% | 76% |
| 1.0.0-a.12-opt | 1874.49 | 59% | 91% | 91% | 76% |
| 1.0.0-a.11-opt | 1678.49 | 59% | 91% | 91% | 76% |
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
    x-axis [.3, .4, .6, .7, .8, .9, .10, .11, .12, .13, .15]
    y-axis "Benchmark Points"
    bar [475.52, 470.49, 1747.98, 1964.43, 446.74, 470, 1660.89, 1678.49, 1874.49, 1658.87, 2141.63]
    line [475.52, 470.49, 1747.98, 1964.43, 446.74, 470, 1660.89, 1678.49, 1874.49, 1658.87, 2141.63]
```

## Speedometer3.0

https://browserbench.org/Speedometer3.0/ 

|           | score:  |
|-----------|-----|
| 1.0.0-a.15-opt | TODO   |
| 1.0.0-a.13-opt | 21.1   |
| 1.0.0-a.12-opt | 21.5   |
| 1.0.0-a.11-opt | 20.8   |
| 1.0.0-a.10 | 21.2 |
| others| - |
| Vivaldi 6.7.3329.39| 27.8 |
| FF nightly 130.0a1 | 27.0 |
| Librewolf 128.0-2 | 20.2 |

## Repository View Counter

<div align='center'><a href='https://www.websitecounterfree.com'><img src='https://www.websitecounterfree.com/c.php?d=9&id=57772&s=40' border='0' alt='Free Website Counter'></a><br / ><small><a href='https://www.websitecounterfree.com' title="Free Website Counter">Free Website Counter</a></small></div>

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
    F-->T(Linux Specific)
    F-->W(Linux Generic)
    F-->V(Win install Generic)
    F-->Z(Win install Specific)
    V-->Z(Zip Generic)
    V-->Z1(Zip Specific)
    I-->I1(windows.mar)
    I-->I2(linux.mar)
    I-->I3(macos.mar)
    I-->I1(windows-generic.mar)
    I-->I2(linux-generic.mar)
    I-->I3(macos-generic.mar)
    T-->T1(zen.linux-specific.tar.bz2)
    T-->T2(zen.linux-generic.tar.bz2)
    T-->T2(AUR)
    T-->T3(Flatpak)
    T-->T4(AppImage)
    T-->T4(AppImage Generic)
    L-->L1(zen.macos-aarch64.dmg)
    L-->L1(zen.macos-x64_86.dmg)
```
