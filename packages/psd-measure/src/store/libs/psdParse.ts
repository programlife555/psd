/**
 * Updated by n.see on 2022/12/06.
 */
import { array2hex, array2rgba, unique } from "@/core/utils";

export interface PSDDocument {
    width: number;
    height: number;
    resources: Record<string, any>;
}

export interface PSDNode {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
}

export interface PSDText {
    bottom: number;
    font: Record<string, any>;
    left: number;
    right: number;
    top: number;
    transform: Record<string, any>;
    value: string;
}

export interface PSDGroup extends PSDNode {
    blendingMode: string;
    children: Array<PSDGroup | PSDLayer>;
    name: string;
    opacity: number;
    type: "group";
    visible: boolean;
    isGroup: () => boolean;
    hidden: () => boolean;
    export: () => Record<string, any>;
}

export interface PSDMask extends PSDNode {
    defaultColor: number;
    disabled: boolean;
    invert: boolean;
    relative: boolean;
}

export interface PSDLayer extends PSDNode {
    id: number;
    blendingMode: string;
    image: Record<string, any>;
    mask: PSDMask;
    name: string;
    opacity: number;
    text?: PSDText;
    type: "layer";
    visible: boolean;
    isGroup: () => boolean;
    hidden: () => boolean;
    export: () => Record<string, any>;
}
export type PSDChildren = Array<PSDGroup | PSDLayer>;

export default class PsdParse {
    psdTree: any;
    treeExport: {
        children: PSDChildren;
        document: PSDDocument;
    };
    children: PSDChildren;
    document: PSDDocument;
    descendants: any[];
    layers: any[];
    constructor(psdTree: any) {
        this.psdTree = psdTree;
        this.treeExport = this.psdTree.export();
        this.children = this.treeExport.children;
        this.document = this.treeExport.document;
        this.descendants = this.psdTree.descendants();
        this.layers = [];
    }
    parse() {
        this.parseLayer(this.descendants);
        this.overflows();
        console.log("===", this.layers);
        this.parseLayers(this.descendants);
        return this;
    }

    /**
     * 获取扁平图层
     * @returns {Array}
     */
    getLayers() {
        return this.layers;
    }

    /**
     * 遍历修正溢出层
     */
    overflows() {
        this.layers.map((layer) => {
            return this.overflow(layer);
        });
    }

    /**
     * 修正溢出的层
     * @param layer
     * @returns {*}
     */
    overflow(layer: PSDLayer) {
        let { top, right, bottom, left, width, height } = Object.assign(
            {},
            layer
        );
        const docWidth = this.document.width;
        const docHeight = this.document.height;
        top = top > 0 ? top : 0;
        left = left > 0 ? left : 0;
        width = width > docWidth - left ? docWidth - left : width;
        height = height > docHeight - top ? docHeight - top : height;
        return Object.assign(layer, {
            top,
            left,
            right,
            bottom,
            width,
            height,
        });
    }
    parseLayers(descendants: any[]) {
        descendants.forEach((node, index) => {
            if (index < 10) {
                var nodeInfo = node.export();
                // console.log(nodeInfo);
                // console.log('node:', node)
            }
        });
        // console.log('descendants====xxx:', descendants)
    }
    /**
     * 图层扁平化
     * 修正偏移
     * @param children
     */
    parseLayer(children: PSDChildren) {
        if (children.length === 0) {
            return;
        }
        children.forEach((node, index) => {
            if (node.isGroup() || node.hidden()) {
                return true;
            }
            const item = node.export();
            // let png = node.toPng()
            if (item.width <= 0 || item.height <= 0) {
                // 无效数据
                return;
            }
            if (item.type === "layer" && item.visible) {
                // console.log(node.name, node, item)
                const layer = {
                    id: index,
                    name: item.name,
                    type: item.type,
                    opacity: item.opacity,
                    zIndex: -(item.width * item.height),
                    // item: item,
                    image: false,
                    bgColor: "",
                    border: null,
                };
                if (item.text) {
                    Object.assign(layer, {
                        top: item.top,
                        right: item.right,
                        bottom: item.bottom,
                        left: item.left,
                        width: item.width,
                        height: item.height,
                        text: this.parseText(item.text),
                    });
                    if (item.text && item.text.font) {
                        Object.assign(layer, {
                            font: this.parseFont(item.text.font),
                        });
                    }
                } else {
                    // Object.assign(layer, {
                    //     top: item.top + 1,
                    //     right: item.right - 1,
                    //     bottom: item.bottom - 1,
                    //     left: item.left + 1,
                    //     width: item.width - 2,
                    //     height: item.height - 2,
                    // });
                    Object.assign(layer, {
                        top: item.top,
                        right: item.right,
                        bottom: item.bottom,
                        left: item.left,
                        width: item.width,
                        height: item.height,
                    });
                }
                this.layers.push(layer);
            }
        });
    }

    _base64ToArrayBuffer(base64: string) {
        const binaryString = window.btoa(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    parseText(text: PSDText) {
        const { value, top, right, bottom, left } = text;
        return { value, top, right, bottom, left };
    }

    /**
     * 处理文字属性
     * @param font
     * @returns {{aligns: *, colors: *, lineHeights: *, lengthArray: *, names: *, sizes: *, styles: *, textDecoration: *, weights: *}}
     */
    parseFont(font: any) {
        return {
            aligns: this.parseAlignment(font.alignment),
            colors: this.parseColor(font.colors),
            lineHeights: this.parseLeading(font.leading),
            lengthArray: this.parseLengthArray(font.lengthArray),
            names: this.parseName(font.names),
            sizes: this.parseSize(font.sizes),
            styles: this.parseStyle(font.styles),
            textDecoration: this.parseTextDecoration(font.textDecoration),
            weights: this.parseWeight(font.weights),
        };
    }
    parseAlignment(alignment: any) {
        if (!alignment) return;
        return unique(alignment).join("/");
    }
    parseColor(colors: any[]) {
        let newColors: any[] = [];
        colors = unique(colors);
        colors.forEach((item) => {
            newColors.push({
                rgba: array2rgba(item),
                hex: array2hex(item),
            });
        });
        return newColors;
    }
    parseLeading(lineHeights: any[]) {
        if (!lineHeights) return [];
        let newLineHeights: any[] = [];
        lineHeights = unique(lineHeights);
        lineHeights.forEach((item) => {
            newLineHeights.push(`${item}px`);
        });
        return newLineHeights.join("/");
    }
    parseLengthArray(lengthArray: any[]) {
        return lengthArray;
    }
    parseName(names: any[]) {
        return unique(names);
    }
    parseSize(sizes: any[]) {
        let newSize: any[] = [];
        sizes = unique(sizes);
        sizes.forEach((item) => {
            newSize.push(`${item}px`);
        });
        return newSize.join("/");
    }
    parseStyle(styles: any[]) {
        return unique(styles).join("/");
    }
    parseTextDecoration(textDecoration: any[]) {
        return textDecoration;
    }
    parseWeight(weights: any[]) {
        return unique(weights).join("/");
    }
}
