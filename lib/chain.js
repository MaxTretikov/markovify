const ArrayKeyedMap = require('array-keyed-map')

const BEGIN = "___BEGIN__"
const END = "___END__"

const bisect = (a, x) => {
    let hi = a.length
    let lo = 0
    while (lo < hi) {
        let mid = Math.floor((lo+hi)/2)
        // Use __lt__ to match the logic in list.sort() and in heapq
        if (x < a[mid]) { hi = mid }
        else { lo = mid+1 }
    }
    return lo
}

const cumulativeSum = (array) => array.reduce((a, x, i) => [...a, x + (a[i - 1] || 0)], []);

const compile_next = (next_dict) => {
    let words = Object.keys(next_dict)
    let cff = cumulativeSum(Object.values(next_dict))
    return [words, cff]
}

const Chain = class {
    constructor(corpus, state_size, model) {
        this.state_size = state_size
        this.model = model
        this.begin_state = Array(this.state_size).fill(BEGIN)
        this.compiled = (this.model.length > 0) && (Array.isArray(this.model.get(this.begin_state)))
        if (!this.compiled) { this.precompute_begin_state() }
    }

    precompute_begin_state() {
        let [choices, cumdist] = compile_next(this.model.get(this.begin_state))
        this.begin_cumdist = cumdist
        this.begin_choices = choices
    }

    move(state) {
        let choices;
        let cumdist;
        let weights;

        if (this.compiled) {
            [choices, cumdist] = this.model.get(state)
        } else if (state == this.begin_state) {
            choices = this.begin_choices
            cumdist = this.begin_cumdist
        } else {
            choices = Object.keys(this.model.get(state))
            weights = Object.values(this.model.get(state))
            cumdist = cumulativeSum(weights)
        }

        let r = Math.random() * cumdist.slice(-1)[0]
        let selection = choices[bisect(cumdist, r)]
        return selection
    }

    *gen(init_state=null) {
        var state = init_state ? init_state : this.begin_state
        // let state = this.begin_state
        while (true) {
            let next_word = this.move(state)
            if (next_word === END) { break }
            yield next_word
            state = state.slice(1).concat(next_word)
        }
    }

    walk(init_state=null) {
        return Array.from(this.gen(init_state))
    }

    static from_json(json_thing) {
        let obj = (typeof json_thing === "string" ? JSON.parse(json_thing) : json_thing)
        let rehydrated = new ArrayKeyedMap()

        if (Array.isArray(obj)) {
            for (let item of obj) {
                rehydrated.set(item[0], item[1])
            }
        } else if (typeof obj == "object") {
            // FIXME: can't be fucked to set up the akmap *and* this
            // console.log(obj)
            // rehydrated = obj
        } else {
            console.log("Something has gone seriously wrong. Object is neither Array nor Object")
        }

        let state_size = Array.from(rehydrated.keys())[0].length

        return new Chain(null, state_size, rehydrated)
    }
}

module.exports = Chain
