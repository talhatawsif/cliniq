# Choosing the assistant's models (research, 14 Nov 2026)

The free OpenRouter key allows 50 requests a day in total, so the models were chosen from the probe (13 requests, `docs/llm-probe.md`)
plus published benchmarks, not from repeated runs of the 20-question evaluation.

| Model | Evidence | Verdict |
|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Passed our probe (4.3 s). NVIDIA reports Humanity's Last Exam 26.7 (37.4 with tools), IFBench 81.7 (instruction following), Multi-Challenge 63.8; BenchLM lists AA-IFBench 81.4, AA-Omniscience hallucination rate 22.6 %, AA-LCR 67.0 % | **First**: the strongest instruction-following and long-context numbers, which is what a cited, format-bound answer needs |
| `baidu/ernie-5.5-flash-preview:free` | Passed our probe (2.5 s). Public numbers found are for the *base* checkpoint (280B/14B active) from secondary write-ups; none for the post-trained preview | **Second**: fast and passed, but little independent evidence |
| `cohere/north-mini-code:free` | Passed our probe (2.9 s). A 30B/3B-active *coding* model (SWE-bench Verified 67.6, Terminal-Bench 36.0 as reported by Cohere); aggregators disagree on its Intelligence Index (9.9 to 27.6) | **Third**: concise and correct on the probe, but built for code, so it is the last resort rather than the first choice it had been |
| `google/gemma-4-31b-it:free` | Rate-limited during the probe, so unverified. Artificial Analysis lists an Intelligence Index of 22 (non-reasoning) | **Not in the chain yet.** Add it after a one-request probe when the daily limit allows |

Why this order matters less than it looks: every model's reply goes through the same output filter, which drops any sentence not
supported by the cited facts. A weaker model costs answers ("the record doesn't contain that"), not safety.

Caveats: the benchmark figures are mostly provider-reported, measure general ability rather than grounded clinical question answering,
and move every few weeks (Artificial Analysis changed its index on 27 Oct 2026, so older scores are not comparable). The 20-question
evaluation (`npm run assistant:eval`) remains the measure for this task; run it once when the limit has reset, not repeatedly.

Sources: [NVIDIA model card mirror](https://dell.huggingface.co/models/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16),
[BenchLM: Nemotron 3 Ultra](https://benchlm.ai/models/nemotron-3-ultra),
[ERNIE 5.5 Flash Base](https://braindetox.kr/en/posts/baidu_ernie_5_5_flash_base.html),
[Cohere North Mini Code (Raschka)](https://www.sebastianraschka.com/blog/2026/north-mini-code-agentic-coding.html),
[North Mini Code on OpenRouter](https://openrouter.ai/models/cohere/north-mini-code),
[Gemma 4 31B on Artificial Analysis](https://artificialanalysis.ai/models/gemma-4-31b-non-reasoning),
[Intelligence Index v5 coverage](https://letsdatascience.com/news/artificial-analysis-index-v5-drops-kimi-k31-pro-from-fourth-563911c6).
