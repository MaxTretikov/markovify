const Chain = require('./chain')

// TODO: docs, testing

const DEFAULT_MAX_OVERLAP_RATIO = 0.7
const DEFAULT_MAX_OVERLAP_TOTAL = 15
const DEFAULT_TRIES = 10

const BEGIN = "___BEGIN__"

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const Text = class {
    constructor (input_text, state_size=2, chain=null, parsed_sentences=null, retain_original=true, well_formed=true) {
        this.well_formed = well_formed

        let can_make_sentences = (parsed_sentences != null) || (input_text != null)
        this.retain_original = (retain_original) && (can_make_sentences)
        this.state_size = state_size

        if (this.retain_original) {
            this.parsed_sentences = parsed_sentences ? parsed_sentences : Array(this.generate_corpus(input_text))

            // Rejoined text lets us assess the novelty of generated sentences
            this.rejoined_text = this.sentence_join(this.parsed_sentences.map(this.word_join))
            this.chain = chain ? chain : Chain(this.parsed_sentences, state_size)
        } else {
            if (!chain) {
              let parsed = parsed_sentences ? parsed_sentences : this.generate_corpus(input_text)
              chain = Chain(parsed, state_size)
            }
            this.chain = chain
        }
    }

    static from_dict(json_obj) {
        // no idea why we need to do this but we do or else there's a keyerror
        let state_size = json_obj["state_size"]
        let chain = Chain.from_json(json_obj["chain"])
        let parsed_sentences = json_obj["parsed_sentences"] ? json_obj["parsed_sentences"] : null

        return new Text(
            null,
            state_size,
            chain,
            parsed_sentences
        )
    }

    static from_json(json_str) {
        return Text.from_dict(JSON.parse(json_str))
    }

    sentence_join(sentences) {
        return sentences.join(" ")
    }

    word_split(sentence) {
        // eslint-disable-next-line no-useless-escape
        return sentence.split("\s+") // This is a regex
    }

    word_join(words) {
        return words.join(" ")
    }

    test_sentence_output(words, max_overlap_ratio, max_overlap_total) {
        // Reject large chunks of similarity
        let overlap_ratio = Math.round(max_overlap_ratio * words.length)
        let overlap_max = Math.min(max_overlap_total, overlap_ratio)
        let overlap_over = overlap_max + 1

        let gram_count = Math.max((words.length - overlap_max), 1)

        let grams = []
        for (let i = 0; i < gram_count; i++) {
            grams.push(words.slice(i, i + overlap_over))
        }

        for (let g of grams) {
            let gram_joined = this.word_join(g)
            if (this.rejoined_text.includes(gram_joined)) {
                return false
            }
        }
        return true
    }

    make_sentence(init_state=null, max_words=null, min_words=null, tries=DEFAULT_TRIES, max_overlap_ratio=DEFAULT_MAX_OVERLAP_RATIO, max_overlap_total=DEFAULT_MAX_OVERLAP_TOTAL, test_output=true) {
        let mor = max_overlap_ratio
        let mot = max_overlap_total
        let prefix = []

        if (init_state != null) {
            prefix = Array(init_state)
            for (let word of prefix) {
                if (word === BEGIN) { prefix = prefix.slice(1) }
                else { break }
            }
        }

        for (let i = 0; i < tries; i++) {
            let words = prefix.concat(this.chain.walk(init_state))
            if (((max_words != null) && (words.length > max_words)) || ((min_words != null) && (words.length < min_words))) {
                continue
            } if (test_output && this.retain_original) {
                if (this.test_sentence_output(words, mor, mot)) {
                    return this.word_join(words)
                }
            } else {
                return this.word_join(words)
            }
        }

        return null
    }

     make_sentence_with_start(beginning, strict=true, ...kwargs) {
        let split = Array(this.word_split(beginning))
        let word_count = split.length
        let init_states

        if (word_count === this.state_size) {
            init_states = [ split ]
        } else if ((word_count > 0) && (word_count < this.state_size)) {
            if (strict) {
                init_states = [ Array((this.state_size - word_count) + split).fill(BEGIN) ]
            } else {
                init_states = []
                for (let key of Array.from(this.chain.model.keys())) {
                    if (Array(key.filter((e) => e != BEGIN).slice(0, word_count) == split)) {
                        init_states.push(key)
                    }
                }
                shuffle(init_states)
            }
        } else {
            console.log(`make_sentence_with_start for this model requires a string containing 1 to ${this.state_size} words. Yours has ${word_count}: ${String(split)}`)
        }

        for (let init_state of init_states) {
            let output = this.make_sentence(init_state, ...kwargs)
            if (output != null) { return output }
        }
        console.log(`make_sentence_with_start can't find sentence beginning with ${beginning}`)
    }

    // @classmethod
    //  from_chain(cls, chain_json, corpus=null, parsed_sentences=null) {
    //     chain = Chain.from_json(chain_json)
    //     return cls(corpus or null, parsed_sentences=parsed_sentences, state_size=chain.state_size, chain=chain)
}

module.exports = Text
